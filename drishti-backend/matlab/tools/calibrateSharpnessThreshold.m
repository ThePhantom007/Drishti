function calibrateSharpnessThreshold(imageDir, numSamples)
%CALIBRATESHARPNESSTHRESHOLD Measure raw (unscaled) Laplacian-variance
%   sharpness across a batch of real images, plus a deliberately blurred
%   version of one of them, so you can pick a threshold based on evidence
%   instead of a guess. Run this once, look at the printed numbers, then set
%   config/pipeline_config.yaml -> image_quality.min_sharpness_laplacian_var
%   to a value that sits comfortably below your real (sharp) images and
%   above the deliberately-blurred control.
%
%   calibrateSharpnessThreshold('data/aptos2019/train_images')
%   calibrateSharpnessThreshold('data/aptos2019/train_images', 30)  % sample size
%
%   Uses the SAME color-agnostic FOV-masking logic as assessImageQuality.m
%   so the numbers you see here are exactly what the pipeline will compute --
%   no need to guess whether this matches production behavior.

    if nargin < 2
        numSamples = 20;
    end

    files = dir(fullfile(imageDir, '*.png'));
    if isempty(files)
        files = dir(fullfile(imageDir, '*.jpg'));
    end
    if isempty(files)
        error('calibrateSharpnessThreshold:noImages', 'No .png/.jpg files found in %s', imageDir);
    end

    numSamples = min(numSamples, numel(files));
    rawScores = zeros(numSamples, 1);
    names = cell(numSamples, 1);

    fprintf('Measuring raw sharpness (Laplacian variance x 1e4) on %d real images...\n', numSamples);
    for i = 1:numSamples
        imgPath = fullfile(files(i).folder, files(i).name);
        img = imread(imgPath);
        rawScores(i) = rawSharpness(img);
        names{i} = files(i).name;
        fprintf('  %-30s raw_sharpness=%.4f\n', files(i).name, rawScores(i));
    end

    fprintf('\n--- Real image statistics ---\n');
    fprintf('min=%.4f  median=%.4f  mean=%.4f  max=%.4f\n', ...
        min(rawScores), median(rawScores), mean(rawScores), max(rawScores));

    % --- Control: deliberately blur the first image and re-measure ----------
    firstImg = imread(fullfile(files(1).folder, files(1).name));
    blurred = imgaussfilt(firstImg, 8); % heavy, unambiguous blur
    blurredScore = rawSharpness(blurred);
    fprintf('\n--- Deliberately-blurred control (heavy Gaussian blur of %s) ---\n', names{1});
    fprintf('raw_sharpness=%.4f  (original was %.4f)\n', blurredScore, rawScores(1));

    fprintf(['\nSet image_quality.min_sharpness_laplacian_var to a value comfortably ' ...
        'between the blurred control (%.4f) and your real images'' minimum (%.4f) -- ' ...
        'e.g. roughly the midpoint, or closer to the blurred side if you want to be ' ...
        'lenient. Do NOT set it above your real images'' minimum or you''ll reject good photos.\n'], ...
        blurredScore, min(rawScores));
end

function raw = rawSharpness(img)
%RAWSHARPNESS Mirrors assessImageQuality.m's sharpness calc exactly (color-
%   agnostic FOV mask + Laplacian variance within it), returned unscaled/
%   unthresholded for calibration purposes.
    grayD = im2double(im2gray(img));
    imgD_rgb = im2double(img);
    colorAgnosticIntensity = max(imgD_rgb, [], 3);
    shortSide = min(size(img, 1), size(img, 2));

    bw = imbinarize(colorAgnosticIntensity, graythresh(colorAgnosticIntensity));
    closingRadius = max(3, round(shortSide * 0.015));
    bw = imclose(bw, strel('disk', closingRadius));
    bw = imfill(bw, 'holes');
    bw = bwareafilt(bw, 1);
    if ~any(bw(:))
        bw = true(size(grayD));
    end

    lap = fspecial('laplacian', 0.2);
    lapResponse = imfilter(grayD, lap, 'replicate');
    raw = var(lapResponse(bw)) * 1e4;
end
