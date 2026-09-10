function recommendation = runCapacitySweep(cfg, flaggedFraction)
%RUNCAPACITYSWEEP Sweep reviewer headcount & bandwidth to find minimum viable
%   staffing for the target patient volume, using the model built by
%   buildCapacityModel.m. Produces the resourcing table for the pitch deck's
%   "district-level program serving 100,000+ patients annually" requirement.
%
%   recommendation = runCapacitySweep(cfg)
%   recommendation = runCapacitySweep(cfg, flaggedFraction)
%
%   flaggedFraction: the fraction of screened cases that require human
%   review. This should be the ACTUAL measured review_rate from whichever
%   model/ensemble/threshold you deploy (see python/training/evaluate_ensemble.py
%   and tune_referable_threshold.py, both of which print review_rate directly)
%   -- NOT guessed. Different deployment candidates can have wildly different
%   review rates (this project has seen anywhere from ~13% to ~55% across
%   otherwise-similar-looking checkpoints), and that number directly
%   determines district staffing cost -- a candidate with higher effective
%   sensitivity but a much higher review rate may not actually be the better
%   real-world choice once you see what it costs in reviewers here. Defaults
%   to 0.25 ONLY if omitted, purely for backward compatibility -- treat that
%   default as a placeholder, not a real assumption, in any real analysis.
%
%   Output: table with columns [reviewers, bandwidth_mbps, avg_queue_wait_min,
%   stable] — "stable" means the review queue doesn't grow unboundedly at the
%   target arrival rate (utilization < 1).

    if nargin < 1 || isempty(cfg)
        rootDir = fileparts(fileparts(mfilename('fullpath')));
        cfg = loadConfig(fullfile(rootDir, '..', 'config', 'pipeline_config.yaml'));
    end
    if nargin < 2 || isempty(flaggedFraction)
        flaggedFraction = 0.25; % PLACEHOLDER -- see docstring; pass the real measured review_rate
        warning('runCapacitySweep:placeholderReviewRate', ...
            ['Using placeholder flaggedFraction=0.25 -- this has not been validated against ' ...
             'your actual deployed model. Pass the real review_rate printed by ' ...
             'evaluate_ensemble.py / tune_referable_threshold.py for a trustworthy staffing number.']);
    end

    arrivalPerDay = cfg.simulink.patients_per_year_target / cfg.simulink.working_days_per_year;
    arrivalPerSec = arrivalPerDay / (8 * 3600); % 8-hour working day

    reviewerCounts = 1:20; % widened -- some measured review rates (e.g. ~50%) need more than 10
    bandwidthOptionsMbps = [10, 25, 50, 100];

    rows = {};
    for r = reviewerCounts
        for bw = bandwidthOptionsMbps
            flaggedArrivalPerSec = arrivalPerSec * flaggedFraction;
            serviceRatePerReviewerPerSec = 1 / cfg.simulink.avg_review_time_sec_flagged;
            totalServiceRate = r * serviceRatePerReviewerPerSec;

            utilization = flaggedArrivalPerSec / totalServiceRate;
            stable = utilization < 0.85; % keep headroom below saturation

            if stable
                % M/M/c-style approximate expected wait (simplified, not exact Erlang-C)
                avgWaitMin = (utilization / (1 - utilization)) * ...
                    (cfg.simulink.avg_review_time_sec_flagged / 60) / r;
            else
                avgWaitMin = Inf;
            end

            bandwidthNeededMbps = (arrivalPerSec * cfg.simulink.bandwidth_per_image_mb * 8);
            bandwidthOK = bw >= bandwidthNeededMbps;

            rows(end+1, :) = {r, bw, avgWaitMin, stable && bandwidthOK}; %#ok<AGROW>
        end
    end

    recommendation = cell2table(rows, ...
        'VariableNames', {'reviewers', 'bandwidth_mbps', 'avg_queue_wait_min', 'stable'});

    viable = recommendation(recommendation.stable, :);
    if isempty(viable)
        warning('runCapacitySweep:noViableConfig', ...
            'No swept configuration is stable at target volume — widen the sweep ranges.');
    else
        [~, idx] = min(viable.reviewers .* 1000 + viable.bandwidth_mbps); % cheapest-first heuristic
        best = viable(idx, :);
        fprintf(['[runCapacitySweep] At review_rate=%.1f%%: recommended %d reviewer(s), %d Mbps, ' ...
            'avg wait %.1f min, serving %.0f patients/day at target volume.\n'], ...
            flaggedFraction * 100, best.reviewers, best.bandwidth_mbps, best.avg_queue_wait_min, arrivalPerDay);
    end
end
