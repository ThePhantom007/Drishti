function calibrated = calibrateConfidence(rawConfidence, cfg)
%CALIBRATECONFIDENCE Platt-scale raw softmax confidence to a trustworthy probability.
%   calibrated = calibrateConfidence(rawConfidence, cfg)
%
%   Raw softmax outputs from deep classifiers are notoriously overconfident
%   (Guo et al., 2017). This applies a simple Platt/temperature-scaling
%   transform whose parameters (A, B) should be fit on a held-out calibration
%   split (see python/training — fit temperature there, store in config).
%   Falls back to identity scaling if no fitted parameters are present, with
%   a warning, so this is never silently wrong.
%
%   Output struct:
%     confidence (double, [0,1] calibrated)
%     requires_human_review (logical)

    if isfield(cfg.grading, 'platt_A') && isfield(cfg.grading, 'platt_B')
        A = cfg.grading.platt_A;
        B = cfg.grading.platt_B;
    else
        A = 1; B = 0; % identity fallback
        warning('calibrateConfidence:noFittedParams', ...
            ['No fitted Platt-scaling parameters in config. Using identity ' ...
             'transform (uncalibrated). Fit temperature/Platt params on a ' ...
             'held-out validation split before reporting real numbers.']);
    end

    logit = log(rawConfidence / max(1 - rawConfidence, 1e-6));
    calibratedProb = 1 / (1 + exp(-(A * logit + B)));

    calibrated = struct( ...
        'confidence', calibratedProb, ...
        'requires_human_review', calibratedProb < cfg.grading.confidence_review_threshold ...
    );
end
