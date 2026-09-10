function normalized = preprocessFundusForNet(img, imgSize)
%PREPROCESSFUNDUSFORNET Resize + Ben Graham normalize + ImageNet-normalize a
%   fundus image for the trained severity network. MUST match python/training/
%   train_severity_classifier.py's validation-time transform exactly (A.Resize
%   -> ben_graham_preprocess -> A.Normalize with ImageNet mean/std ->
%   ToTensorV2). Shared by predictSeverity.m and generateGradCAM.m so the two
%   can never drift out of sync with each other -- a common, hard-to-notice
%   bug source when preprocessing is duplicated.
%
%   normalized = preprocessFundusForNet(img)
%   normalized = preprocessFundusForNet(img, imgSize)   % default 380
%
%   Output: HxWx3 double, ImageNet-normalized (NOT yet a dlarray -- callers
%   convert to dlarray themselves since predict() and gradCAM() may want
%   slightly different array wrapping).
%
%   IMPORTANT: if you retrain WITHOUT Ben Graham preprocessing (i.e. an older
%   severity_net.onnx trained before this was added), this function will
%   silently feed the model a different input distribution than it was
%   trained on, degrading accuracy without any error. Keep this in sync with
%   whichever version of dataset.py's ben_graham_preprocess() actually
%   produced your currently-loaded model.

    if nargin < 2
        imgSize = 380; % must match IMG_SIZE in train_severity_classifier.py
    end

    resized = imresize(img, [imgSize, imgSize]);
    resizedD = double(resized); % keep [0,255] scale to mirror Python's uint8 arithmetic exactly

    % --- Ben Graham local color/illumination normalization -------------------
    % Mirrors dataset.py's ben_graham_preprocess() exactly: subtract a heavily
    % blurred version of the image (cv2.addWeighted(img,4,blurred,-4,128)),
    % then mask the outer ~10% to neutral gray via a circular mask.
    sigma = imgSize / 30;
    blurred = imgaussfilt(resizedD, sigma);
    enhanced = 4 * resizedD - 4 * blurred + 128;

    [X, Y] = meshgrid(1:imgSize, 1:imgSize);
    center = imgSize / 2;
    radius = 0.45 * imgSize;
    mask = ((X - center).^2 + (Y - center).^2) <= radius^2;
    mask3 = repmat(mask, 1, 1, 3);

    benGraham = enhanced .* mask3 + 128 * (1 - mask3);
    benGraham = min(max(benGraham, 0), 255);

    % --- ImageNet normalization -----------------------------------------------
    imgD = benGraham / 255; % [0,255] -> [0,1]

    imagenetMean = reshape([0.485, 0.456, 0.406], 1, 1, 3);
    imagenetStd  = reshape([0.229, 0.224, 0.225], 1, 1, 3);
    normalized = (imgD - imagenetMean) ./ imagenetStd;
end
