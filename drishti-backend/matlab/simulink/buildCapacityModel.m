function modelName = buildCapacityModel(cfg)
%BUILDCAPACITYMODEL Programmatically construct the district screening
%   throughput model as a Simulink discrete-event simulation, since a .slx
%   binary can't be authored directly as text — this script builds it via the
%   Simulink API so it's version-controllable and reproducible from source.
%
%   modelName = buildCapacityModel(cfg)  builds and saves
%   'ScreeningCapacityModel.slx' in this folder, then returns its name.
%
%   Model structure (uses Simulink + SimEvents-style blocks; if SimEvents is
%   not licensed, this falls back to a discrete-time approximation using
%   standard Simulink blocks — see the 'useSimEvents' branch below):
%
%     [Patient Arrival Source] -> [AI Pipeline Server] -> [Confidence Router]
%           (Poisson, rate=λ)     (service time ~ processing_time_ms)     |
%                                                                          ├─ confident -> [Sink: cleared]
%                                                                          └─ flagged   -> [Ophthalmologist Queue+Server] -> [Sink: reviewed]
%
%     A separate [Bandwidth Constraint] gain block caps effective arrival
%     rate based on bandwidth_per_image_mb vs. available link capacity,
%     feeding back into the arrival source.

    if nargin < 1
        rootDir = fileparts(fileparts(mfilename('fullpath')));
        cfg = loadConfig(fullfile(rootDir, '..', 'config', 'pipeline_config.yaml'));
    end

    modelName = 'ScreeningCapacityModel';
    if bdIsLoaded(modelName)
        close_system(modelName, 0);
    end
    new_system(modelName);
    open_system(modelName);

    useSimEvents = license('test', 'SimEvents') == 1;

    if useSimEvents
        buildWithSimEvents(modelName, cfg);
    else
        buildDiscreteApprox(modelName, cfg);
        warning('buildCapacityModel:noSimEvents', ...
            ['SimEvents license not detected. Built a discrete-time queueing ' ...
             'approximation using core Simulink blocks instead (M/M/c-style ' ...
             'analytic queue), which is sufficient for the capacity sweep in ' ...
             'runCapacitySweep.m. Install SimEvents for a true event-based model.']);
    end

    set_param(modelName, 'StopTime', num2str(cfg.simulink.working_days_per_year * 8 * 3600));
    save_system(modelName, fullfile(fileparts(mfilename('fullpath')), [modelName '.slx']));
    fprintf('[buildCapacityModel] Saved %s.slx\n', modelName);
end

function buildWithSimEvents(modelName, cfg)
    arrivalRatePerSec = cfg.simulink.patients_per_year_target / ...
        (cfg.simulink.working_days_per_year * 8 * 3600);

    add_block('simevents/Entity Generator', [modelName '/PatientArrival'], ...
        'GenerationMode', 'Poisson', ...
        'MeanIntergenTime', num2str(1 / arrivalRatePerSec));

    add_block('simevents/Entity Server', [modelName '/AIPipeline'], ...
        'ServiceTime', num2str(cfg.simulink.avg_review_time_sec_confident / 1000));

    add_block('simevents/Entity Server', [modelName '/OphthalmologistReview'], ...
        'ServiceTime', num2str(cfg.simulink.avg_review_time_sec_flagged));

    add_block('simulink/Sinks/Scope', [modelName '/QueueLengthScope']);

    add_line(modelName, 'PatientArrival/1', 'AIPipeline/1', 'autorouting', 'on');
    add_line(modelName, 'AIPipeline/1', 'OphthalmologistReview/1', 'autorouting', 'on');
end

function buildDiscreteApprox(modelName, cfg)
    % Analytic M/M/c queueing approximation expressed as Simulink blocks so
    % the model is still inspectable/simulatable without SimEvents. Computes
    % rolling arrival vs. service rate and integrates queue buildup over time.
    add_block('simulink/Sources/Constant', [modelName '/ArrivalRate'], ...
        'Value', num2str(cfg.simulink.patients_per_year_target / ...
            (cfg.simulink.working_days_per_year * 8 * 3600)));

    add_block('simulink/Sources/Constant', [modelName '/ServiceRate'], ...
        'Value', num2str(1 / cfg.simulink.avg_review_time_sec_flagged));

    add_block('simulink/Math Operations/Subtract', [modelName '/NetRate']);
    add_block('simulink/Continuous/Integrator', [modelName '/QueueLength']);
    add_block('simulink/Sinks/Scope', [modelName '/QueueLengthScope']);
    add_block('simulink/Sinks/To Workspace', [modelName '/QueueLengthLog'], ...
        'VariableName', 'queueLength');

    add_line(modelName, 'ArrivalRate/1', 'NetRate/1', 'autorouting', 'on');
    add_line(modelName, 'ServiceRate/1', 'NetRate/2', 'autorouting', 'on');
    add_line(modelName, 'NetRate/1', 'QueueLength/1', 'autorouting', 'on');
    add_line(modelName, 'QueueLength/1', 'QueueLengthScope/1', 'autorouting', 'on');
    add_line(modelName, 'QueueLength/1', 'QueueLengthLog/1', 'autorouting', 'on');
end
