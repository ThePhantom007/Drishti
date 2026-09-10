function [icdrLevel, confidence, probabilities] = predictSeverity(net, img, imgSize, weights)
%PREDICTSEVERITY Run the trained severity classifier on a fundus image.
%   [icdrLevel, confidence, probabilities] = predictSeverity(net, img)
%   [icdrLevel, confidence, probabilities] = predictSeverity(net, img, imgSize)
%   [icdrLevel, confidence, probabilities] = predictSeverity(net, img, imgSize, weights)
%
%   Preprocessing here MUST match python/training/train_severity_classifier.py
%   exactly (same resize size, same ImageNet normalization stats) -- a
%   mismatch here silently degrades accuracy without throwing any error,
%   since the network will still produce *a* prediction, just a wrong one.
%   If you change IMG_SIZE or the normalization in the Python training
%   script, update this function to match.
%
%   Inputs:
%     net     - a single dlnetwork from getSeverityNet.m, OR a cell array of
%               dlnetworks (ensemble mode -- see getSeverityNet.m).
%     img     - RGB fundus image, uint8 or double, any size (will be resized)
%     imgSize - optional, defaults to 380 (matches IMG_SIZE in the training script)
%     weights - optional, only used in ensemble mode (net is a cell array).
%               Numeric vector, same length as net, need not be pre-
%               normalized (this function normalizes to sum to 1). Defaults
%               to equal weighting if omitted. Set via
%               config/pipeline_config.yaml -> paths.severity_model_weights,
%               found empirically by python/training/optimize_ensemble_weights.py
%               -- an unweighted average is not assumed to be optimal, it's
%               just the default when nothing better has been found yet.
%
%   Outputs:
%     icdrLevel     - integer 0-4 (argmax of predicted probabilities)
%     confidence    - raw (uncalibrated) confidence of the predicted class,
%                     i.e. max(probabilities) -- pass this to
%                     calibrateConfidence.m before treating it as trustworthy
%     probabilities - 1x5 double, full softmax distribution over ICDR levels
%                     (already combined across models, if in ensemble mode)

    if nargin < 3 || isempty(imgSize)
        imgSize = 380; % must match IMG_SIZE in train_severity_classifier.py
    end

    normalized = preprocessFundusForNet(img, imgSize);

    % --- Convert to dlarray matching the imported network's expected format --
    % ONNX exports from PyTorch as NCHW; importNetworkFromONNX typically
    % auto-converts image inputs to MATLAB's preferred SSCB (spatial-spatial-
    % channel-batch) layout. If your imported net expects a different format
    % (check via `net.Layers(1)` or `analyzeNetwork(net)` in MATLAB), adjust
    % the label string below to match.
    dlImg = dlarray(single(normalized), 'SSCB');

    % --- Inference -------------------------------------------------------------
    % A single network runs once; an ensemble (cell array) runs each member
    % once and combines the resulting probability distributions via a
    % WEIGHTED average -- NOT the raw logits, since averaging post-softmax
    % (weighted or not) is what optimize_ensemble_weights.py and
    % evaluate_ensemble.py validate against Messidor-2, and averaging
    % pre-softmax logits is a subtly different operation that was never tested.
    if iscell(net)
        if nargin < 4 || isempty(weights)
            weights = ones(numel(net), 1) / numel(net); % equal-weight fallback
        end
        weights = weights(:) / sum(weights); % defensively renormalize
        if numel(weights) ~= numel(net)
            error('predictSeverity:weightMismatch', ...
                'weights has %d entries but net has %d models -- they must match.', ...
                numel(weights), numel(net));
        end

        probsSum = zeros(5, 1);
        for i = 1:numel(net)
            dlLogits = predict(net{i}, dlImg);
            probsSum = probsSum + weights(i) * double(extractdata(softmax(dlLogits)));
        end
        probabilities = probsSum';
    else
        dlLogits = predict(net, dlImg);
        probabilities = double(extractdata(softmax(dlLogits)))';
    end

    [confidence, maxIdx] = max(probabilities);
    icdrLevel = maxIdx - 1; % MATLAB is 1-indexed, ICDR levels are 0-4
end
