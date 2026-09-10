function grading = gradeDRSeverity(lesionFeatures, cfg)
%GRADEDRSEVERITY Classify ICDR severity (0-4) from aggregated lesion features.
%   grading = gradeDRSeverity(lesionFeatures, cfg)
%
%   Two-stage design:
%     1) Rule-based ICDR "4-2-1" clinical criteria as an interpretable
%        baseline/sanity-check (matches the actual clinical grading scale
%        ophthalmologists use, so its reasoning is auditable).
%     2) The trained classifier (matlab/models/getSeverityNet.m + predictSeverity.m)
%        whose prediction is the one reported — the rule-based grade is kept as
%        an explainability cross-check surfaced in the report ("AI grade: 2,
%        matches rule-based ICDR estimate: 2" builds clinician trust; a
%        mismatch is itself useful signal to flag for review).
%
%   lesionFeatures struct (from the calling orchestrator) must contain:
%     .microaneurysm_count, .hemorrhage.count, .hemorrhage.quadrant_counts,
%     .hard_exudate_area_pct, .soft_exudate_present,
%     .nv.nvd_suspected, .nv.nve_suspected, .vessel_mask (for IRMA/venous beading - future work)
%     .enhanced_image (the QA/enhancement-stage image, fed to the trained model)
%
%   Output struct:
%     icdr_level (0-4), icdr_label (char), referable (logical)
%     rule_based_level (0-4), model_confidence [0,1], probabilities (1x5)

    ruleLevel = ruleBasedICDR(lesionFeatures);

    % --- Trained-model grade -------------------------------------------------
    net = getSeverityNet(cfg);

    if ~isempty(net)
        ensembleWeights = [];
        if isfield(cfg.paths, 'severity_model_weights')
            ensembleWeights = cfg.paths.severity_model_weights;
        end
        [modelLevel, modelConfidence, probabilities] = ...
            predictSeverity(net, lesionFeatures.enhanced_image, [], ensembleWeights);

        if modelLevel ~= ruleLevel
            fprintf(['[gradeDRSeverity] Model grade (%d) differs from rule-based ' ...
                'estimate (%d) -- surfaced in report as a review signal.\n'], ...
                modelLevel, ruleLevel);
        end
    else
        modelPathDisplay = cfg.paths.severity_model;
        if iscell(modelPathDisplay) || (isstring(modelPathDisplay) && numel(modelPathDisplay) > 1)
            modelPathDisplay = strjoin(cellstr(modelPathDisplay), ', ');
        end
        warning('gradeDRSeverity:noTrainedModel', ...
            ['No trained severity model found (looked for: %s in %s). Falling back to ' ...
             'rule-based grading only. Train and export a model via python/training/ to ' ...
             'enable the learned classifier.'], ...
            modelPathDisplay, cfg.paths.models_dir);
        modelLevel = ruleLevel;
        modelConfidence = 0.60; % conservative placeholder -> forces human review downstream
        probabilities = [];
    end

    labels = {'No DR', 'Mild NPDR', 'Moderate NPDR', 'Severe NPDR', 'Proliferative DR'};

    % The headline icdr_level shown to a clinician is always the argmax --
    % it's the single most interpretable "which level" answer. But the
    % BINARY referable/not decision (the actual metric the problem
    % statement's targets are about) is decoupled from that argmax whenever
    % a tuned threshold is available: python/training/tune_referable_threshold.py
    % searches P(referable) = P(level >= referable_threshold_level) directly,
    % which explores a materially different, typically richer trade-off space
    % than argmax-of-5-classes ever can. Falls back to the argmax-implied
    % decision (equivalent to a 0.5 threshold) if no tuned value is configured,
    % so this is fully backward compatible.
    if ~isempty(probabilities) && isfield(cfg.grading, 'referable_probability_threshold')
        startIdx = cfg.grading.referable_threshold_level + 1; % MATLAB 1-indexed
        pReferable = sum(probabilities(startIdx:end));
        isReferable = pReferable >= cfg.grading.referable_probability_threshold;
    else
        pReferable = [];
        isReferable = modelLevel >= cfg.grading.referable_threshold_level;
    end

    grading = struct( ...
        'icdr_level', modelLevel, ...
        'icdr_label', labels{modelLevel + 1}, ...
        'referable', isReferable, ...
        'referable_probability', pReferable, ...
        'rule_based_level', ruleLevel, ...
        'model_confidence', modelConfidence, ...
        'probabilities', probabilities ...
    );
end

function level = ruleBasedICDR(f)
%RULEBASEDICDR Simplified International Clinical DR Severity Scale logic.
%   Implements the well-known "4-2-1 rule" for severe NPDR plus PDR/mild/moderate
%   boundary conditions. This is a simplification for engineering/demo purposes —
%   cite the original ICDR scale (Wilkinson et al., 2003) in your report and note
%   this as the interpretable baseline, not the final clinical claim.

    if f.nv.nvd_suspected || f.nv.nve_suspected
        level = 4; % Proliferative DR
        return
    end

    severeCriteria = ...
        any(f.hemorrhage.quadrant_counts >= 20) || ...   % >20 hemorrhages in >=1 quadrant
        f.hemorrhage.count >= 20 * sum(f.hemorrhage.quadrant_counts > 0);

    if severeCriteria
        level = 3; % Severe NPDR
        return
    end

    moderateCriteria = ...
        f.microaneurysm_count > 5 || ...
        f.hemorrhage.count > 0 || ...
        f.hard_exudate_area_pct > 0.5 || ...
        f.soft_exudate_present;

    if moderateCriteria
        level = 2; % Moderate NPDR
        return
    end

    mildCriteria = f.microaneurysm_count > 0;
    if mildCriteria
        level = 1; % Mild NPDR
        return
    end

    level = 0; % No DR
end
