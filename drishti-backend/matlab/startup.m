function startup()
%STARTUP Add all pipeline folders to the MATLAB path and load config.
%   Run this once per session: run('matlab/startup.m')

    thisFile = mfilename('fullpath');
    rootDir = fileparts(thisFile);

    addpath(genpath(fullfile(rootDir, 'pipeline')));
    addpath(genpath(fullfile(rootDir, 'models')));
    addpath(genpath(fullfile(rootDir, 'simulink')));
    addpath(genpath(fullfile(rootDir, 'utils')));
    addpath(genpath(fullfile(rootDir, 'tests')));
    addpath(genpath(fullfile(rootDir, 'tools')));

    cfg = loadConfig(fullfile(rootDir, '..', 'config', 'pipeline_config.yaml')); %#ok<NASGU>

    fprintf('[startup] DR screening pipeline paths loaded. Config OK.\n');
    fprintf('[startup] Try: result = runScreeningPipeline(''path/to/image.png'');\n');
end
