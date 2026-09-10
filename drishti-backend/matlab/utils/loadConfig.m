function cfg = loadConfig(yamlPath)
%LOADCONFIG Load pipeline_config.yaml into a nested struct.
%   cfg = loadConfig('config/pipeline_config.yaml')
%
%   Requires MATLAB R2020b+ (yamlread/readstruct) OR falls back to a minimal
%   built-in parser sufficient for this project's flat/2-level YAML.
%
%   IMPORTANT: cfg.paths.models_dir and cfg.paths.reports_out_dir are
%   written in pipeline_config.yaml as paths relative to the repo root
%   (drishti-backend/), e.g. "matlab/models" -- but nothing in this
%   codebase ever changes MATLAB's working directory to be the repo root.
%   Left as bare relative strings, fullfile(cfg.paths.models_dir, ...)
%   silently resolves against whatever MATLAB's pwd happens to be at
%   that moment, which is often NOT the repo root -- especially when
%   MATLAB is started programmatically via the Python gateway's
%   matlab.engine.start_matlab() (python/gateway/matlab_bridge.py), whose
%   initial working directory is not the repo root either. The practical
%   symptom: real .onnx model files sitting at the exact right path on
%   disk get reported as "not found", and grading silently falls back to
%   rule-based-only. Resolving these two fields to absolute paths here,
%   anchored on this YAML file's own location rather than on pwd, fixes
%   that regardless of how or from where MATLAB was started.

    if exist('readstruct', 'file') == 2
        try
            cfg = readstruct(yamlPath, 'FileType', 'yaml'); %#ok<NASGU>
            cfg = resolveConfigPaths(cfg, yamlPath);
            return
        catch
            % fall through to manual parser below if toolbox support unavailable
        end
    end

    cfg = struct();
    lines = strsplit(fileread(yamlPath), newline);
    sectionStack = {};

    for i = 1:numel(lines)
        raw = lines{i};
        line = regexprep(raw, '#.*$', '');       % strip comments
        if isempty(strtrim(line))
            continue
        end

        indent = numel(raw) - numel(regexprep(raw, '^\s+', ''));
        depth = floor(indent / 2) + 1;
        sectionStack = sectionStack(1:min(depth-1, numel(sectionStack)));

        parts = strsplit(strtrim(line), ':');
        key = matlab.lang.makeValidName(strtrim(parts{1}));

        if numel(parts) == 1 || isempty(strtrim(strjoin(parts(2:end), ':')))
            % new nested section header
            sectionStack{depth} = key; %#ok<AGROW>
            continue
        end

        valueStr = strtrim(strjoin(parts(2:end), ':'));
        value = parseYamlScalar(valueStr);

        path = [sectionStack(1:depth-1), {key}];
        cfg = setNested(cfg, path, value);
    end

    cfg = resolveConfigPaths(cfg, yamlPath);
end

function cfg = resolveConfigPaths(cfg, yamlPath)
%RESOLVECONFIGPATHS Anchor cfg.paths.models_dir / reports_out_dir to the
%   repo root (this YAML file's parent directory) if they're relative, so
%   they resolve correctly regardless of MATLAB's current working
%   directory. Absolute paths (e.g. test_pipeline.m's use of tempdir())
%   are left untouched.
    if ~isfield(cfg, 'paths')
        return
    end

    repoRoot = fileparts(fileparts(absolutePath(yamlPath)));

    fieldsToResolve = {'models_dir', 'reports_out_dir'};
    for i = 1:numel(fieldsToResolve)
        f = fieldsToResolve{i};
        if isfield(cfg.paths, f) && ~isempty(cfg.paths.(f)) && ~isAbsolutePath(cfg.paths.(f))
            cfg.paths.(f) = fullfile(repoRoot, cfg.paths.(f));
        end
    end
end

function p = absolutePath(p)
    if ~isAbsolutePath(p)
        p = fullfile(pwd, p);
    end
end

function tf = isAbsolutePath(p)
    p = char(p);
    if ispc
        tf = ~isempty(regexp(p, '^[A-Za-z]:[\\/]', 'once')) || startsWith(p, '\\');
    else
        tf = startsWith(p, '/');
    end
end

function value = parseYamlScalar(s)
    s = strtrim(s);
    s = regexprep(s, '^"(.*)"$', '$1');
    s = regexprep(s, '^''(.*)''$', '$1');

    if startsWith(s, '[') && endsWith(s, ']')
        inner = s(2:end-1);
        items = strsplit(inner, ',');
        parsed = cellfun(@(x) parseYamlScalar(strtrim(x)), items, 'UniformOutput', false);
        % Numeric lists (e.g. icdr_levels: [0,1,2,3,4]) collapse to a plain
        % numeric array, matching the previous behaviour exactly. String
        % lists (e.g. an ensemble's severity_model: ["a.onnx","b.onnx"])
        % stay as a cell array of char vectors -- MATLAB's iscell() is
        % exactly what getSeverityNet.m checks to detect ensemble mode, so
        % this distinction is load-bearing, not cosmetic.
        if all(cellfun(@isnumeric, parsed)) || all(cellfun(@islogical, parsed))
            value = [parsed{:}];
        else
            value = parsed;
        end
        return
    end

    numVal = str2double(s);
    if ~isnan(numVal) && ~isempty(s)
        value = numVal;
    elseif strcmpi(s, 'true')
        value = true;
    elseif strcmpi(s, 'false')
        value = false;
    else
        value = s;
    end
end

function s = setNested(s, path, value)
    if numel(path) == 1
        s.(path{1}) = value;
    else
        if ~isfield(s, path{1})
            s.(path{1}) = struct();
        end
        s.(path{1}) = setNested(s.(path{1}), path(2:end), value);
    end
end
