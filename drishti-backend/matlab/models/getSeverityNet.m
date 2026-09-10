function net = getSeverityNet(cfg)
%GETSEVERITYNET Load (and cache) the trained severity dlnetwork(s).
%   net = getSeverityNet(cfg)
%
%   Supports two modes, chosen entirely by the shape of
%   cfg.paths.severity_model in config/pipeline_config.yaml:
%     - Single model  (severity_model: "severity_net.onnx")
%       -> returns a single dlnetwork, exactly as before.
%     - Ensemble      (severity_model: ["severity_net_A.onnx", "severity_net_B.onnx"])
%       -> returns a CELL ARRAY of dlnetworks. predictSeverity.m detects
%          this automatically and averages predicted probabilities across
%          all of them (see python/training/evaluate_ensemble.py for the
%          validation step that justifies whether ensembling actually helps
%          before you switch this on).
%
%   Importing an ONNX model is slow (seconds), so every loaded network
%   (single or ensemble) is cached in a persistent variable -- the first
%   call per MATLAB session pays the import cost, every subsequent call
%   (e.g. once per API request via the FastAPI gateway) reuses it. Returns
%   [] if no trained model is present on disk yet, so callers can cleanly
%   fall back to rule-based grading.

    persistent cachedNet cachedKey

    modelSpec = cfg.paths.severity_model;
    isEnsemble = iscell(modelSpec) || (isstring(modelSpec) && numel(modelSpec) > 1);

    if isEnsemble
        modelNames = cellstr(modelSpec);
    else
        modelNames = {char(modelSpec)};
    end

    modelPaths = fullfile(cfg.paths.models_dir, modelNames);
    missing = ~cellfun(@isfile, modelPaths);
    if any(missing)
        net = [];
        return
    end

    cacheKey = strjoin(modelPaths, '|');
    if isempty(cachedNet) || ~strcmp(cachedKey, cacheKey)
        loaded = cell(1, numel(modelPaths));
        for i = 1:numel(modelPaths)
            fprintf('[getSeverityNet] Loading %s (%d/%d)...\n', modelPaths{i}, i, numel(modelPaths));
            loaded{i} = importPyTorchModel(modelPaths{i});
        end
        cachedNet = loaded;
        cachedKey = cacheKey;
        if numel(loaded) > 1
            fprintf('[getSeverityNet] Ensemble mode: %d models will have their predictions averaged.\n', numel(loaded));
        end
    end

    if isEnsemble
        net = cachedNet;               % cell array -> predictSeverity.m averages across all
    else
        net = cachedNet{1};            % single net -> unchanged behaviour from before
    end
end
