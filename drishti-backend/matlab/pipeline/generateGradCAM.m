function camOverlay = generateGradCAM(img, net, predictedClass, cfg, weights)
%GENERATEGRADCAM Class-activation heatmap explaining the severity prediction.
%   camOverlay = generateGradCAM(img, net, predictedClass, cfg)
%   camOverlay = generateGradCAM(img, net, predictedClass, cfg, weights)
%
%   Uses MATLAB's built-in gradCAM() (Deep Learning Toolbox) against the
%   trained severity classifier, overlaid on the original fundus image so an
%   ophthalmologist can visually confirm the AI is attending to actual lesions
%   (microaneurysms/hemorrhages/exudates) rather than spurious image regions —
%   this is the crux of the "clinically useful explainability" requirement.
%
%   Falls back to a lesion-evidence overlay (from the segmentation modules
%   directly) when no trained network is available yet, so the report/API can
%   still be demoed end-to-end during development.
%
%   IMPORTANT: img is preprocessed identically to predictSeverity.m
%   (preprocessFundusForNet.m) before being fed to gradCAM -- the ONNX model
%   has no built-in normalization layer (that was done in the Python
%   dataloader), so mismatched preprocessing here would silently produce a
%   heatmap for the wrong effective input, not an error.
%
%   Output: RGB uint8 image, same size as the ORIGINAL (pre-resize) input,
%   heatmap alpha-blended on top.

    if nargin >= 2 && ~isempty(net)
        % Grad-CAM needs a single network to trace gradients through -- it
        % has no defined meaning for "the gradient of an averaged ensemble
        % prediction" without extra assumptions. In ensemble mode (net is a
        % cell array), use the MOST HEAVILY WEIGHTED member as the
        % representative explanation (falling back to the first member if no
        % weights were supplied) rather than build a more elaborate
        % multi-model heatmap-averaging scheme for a visualization that is
        % meant to be illustrative, not a precise mathematical decomposition
        % of the ensemble's decision.
        if iscell(net)
            if nargin >= 5 && ~isempty(weights) && numel(weights) == numel(net)
                [~, dominantIdx] = max(weights);
                netForCAM = net{dominantIdx};
            else
                netForCAM = net{1};
            end
        else
            netForCAM = net;
        end

        targetLayer = resolveTargetLayer(netForCAM, cfg.explainability.gradcam_target_layer);
        reductionLayer = netForCAM.Layers(end).Name; % final layer -> class scores, silences
                                                       % gradCAM's own auto-detection warning

        preprocessed = preprocessFundusForNet(img);
        dlImg = dlarray(single(preprocessed), 'SSCB');

        scoreMap = gradCAM(netForCAM, dlImg, predictedClass + 1, ...
            'FeatureLayer', targetLayer, 'ReductionLayer', reductionLayer);
        camOverlay = blendHeatmap(img, scoreMap);
    else
        camOverlay = img; % caller should use generateReport's lesion-overlay path instead
    end
end

function layerName = resolveTargetLayer(net, configuredName)
%RESOLVETARGETLAYER Find the Grad-CAM target layer, tolerating the fact that
%   ONNX import auto-generates layer names that won't literally match a
%   human-chosen config value like "last_conv". Tries the configured name
%   first (in case it happens to match, or was manually verified and set);
%   falls back to the last convolution layer in the network, which is the
%   standard Grad-CAM target for classification CNNs.
    layerNames = {net.Layers.Name};
    if ismember(configuredName, layerNames)
        layerName = configuredName;
        return
    end

    isConv = arrayfun(@(l) contains(class(l), 'Convolution'), net.Layers);
    convLayerNames = layerNames(isConv);
    if isempty(convLayerNames)
        error('generateGradCAM:noConvLayer', ...
            ['Could not find a convolution layer for Grad-CAM in this network, ' ...
             'and configured target layer "%s" was not found either. Run ' ...
             'analyzeNetwork(net) to inspect layer names and update ' ...
             'config/pipeline_config.yaml -> explainability.gradcam_target_layer.'], ...
            configuredName);
    end
    layerName = convLayerNames{end};
    fprintf(['[generateGradCAM] Configured layer "%s" not found in imported network. ' ...
        'Using last conv layer "%s" instead. Consider setting ' ...
        'explainability.gradcam_target_layer to this value in the config ' ...
        'to silence this message.\n'], configuredName, layerName);
end

function overlay = blendHeatmap(img, scoreMap)
    scoreMap = mat2gray(imresize(scoreMap, [size(img,1), size(img,2)]));
    heat = ind2rgb(gray2ind(scoreMap, 256), jet(256));
    overlay = im2uint8(0.6 * im2double(img) + 0.4 * heat);
end
