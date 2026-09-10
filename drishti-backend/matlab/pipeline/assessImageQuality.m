function quality = assessImageQuality(img, cfg)
%ASSESSIMAGEQUALITY Evaluate a fundus image for grading adequacy.
%   quality = assessImageQuality(img, cfg)
%
%   Checks resolution, sharpness (focus), illumination (under/over-exposure),
%   and field-of-view coverage. Returns a struct consumed by the orchestrator
%   to decide reject / enhance-then-continue / pass-through.
%
%   Inputs:
%     img - RGB fundus image (uint8, H x W x 3)
%     cfg - config struct (see config/pipeline_config.yaml -> image_quality)
%
%   Output struct fields:
%     adequate            (logical)
%     sharpness_score      [0,1]
%     illumination_score   [0,1]
%     field_of_view_score  [0,1]
%     issues               (cellstr) machine-readable issue codes
%     recapture_message    (char)    human-readable feedback if rejected

    q = cfg.image_quality;
    issues = {};

    gray = im2gray(img);
    grayD = im2double(gray);
    [h, w, ~] = size(img);
    shortSide = min(h, w);

    % --- Resolution check ---------------------------------------------------
    if shortSide < q.min_resolution_px
        issues{end+1} = 'resolution_too_low'; %#ok<AGROW>
    end

    % --- Field-of-view mask (computed FIRST, since sharpness/illumination ---
    % below must be measured only within actual retinal content, not the
    % large black background surrounding it -- fundus images are captured
    % as a circular FOV inside a rectangular frame, and border pixels have
    % near-zero variance/brightness that would otherwise massively skew
    % those metrics regardless of how sharp/well-lit the actual retina is.
    %
    % NOTE: this must NOT be computed on standard green-weighted grayscale
    % luminance (rgb2gray). Real fundus photos often have uneven coloring
    % across the frame -- e.g. a paler/hazier, green-rich region next to a
    % vividly orange-red, green-poor region containing the actual vessels
    % and optic disc. Green-weighted luminance scores the green-poor (but
    % perfectly valid, often sharper) retinal tissue as "dark," causing Otsu
    % thresholding to misclassify real retina as background. Using the
    % per-pixel MAX across R/G/B instead is color-agnostic: true black
    % background has all channels near zero regardless of hue, while any
    % illuminated retinal tissue -- pale or richly colored -- has at least
    % one channel well above zero.
    imgD_rgb = im2double(img);
    colorAgnosticIntensity = max(imgD_rgb, [], 3);

    bw = imbinarize(colorAgnosticIntensity, graythresh(colorAgnosticIntensity));
    closingRadius = max(3, round(shortSide * 0.015)); % scales with image size
    bw = imclose(bw, strel('disk', closingRadius));
    bw = imfill(bw, 'holes'); % fill any remaining internal gaps (optic disc, dense vessels)
    bw = bwareafilt(bw, 1);
    fovArea = sum(bw(:));
    expectedArea = pi * (shortSide / 2)^2;
    fovRatio = fovArea / expectedArea;
    fovScore = min(1, fovRatio / q.min_field_of_view_ratio);
    if fovRatio < q.min_field_of_view_ratio
        issues{end+1} = 'incomplete_field_of_view'; %#ok<AGROW>
    end

    % Fall back to the whole frame if FOV detection failed entirely (e.g. an
    % unusually uniform image) rather than measuring sharpness/illumination
    % over an empty mask, which would produce meaningless (NaN/zero) scores.
    if ~any(bw(:))
        bw = true(h, w);
    end

    % --- Sharpness via variance of Laplacian, WITHIN the FOV only -----------
    lap = fspecial('laplacian', 0.2);
    lapResponse = imfilter(grayD, lap, 'replicate');
    sharpnessRaw = var(lapResponse(bw)) * 1e4;   % scaled for readable thresholds
    sharpnessScore = min(1, sharpnessRaw / (q.min_sharpness_laplacian_var * 2));
    if sharpnessRaw < q.min_sharpness_laplacian_var
        issues{end+1} = 'image_too_blurry'; %#ok<AGROW>
    end

    % --- Illumination: fraction of under/over-exposed pixels, WITHIN the FOV -
    fovPixels = grayD(bw);
    pctDark = 100 * mean(fovPixels < 0.05);
    pctBright = 100 * mean(fovPixels > 0.97);
    illuminationOK = (pctDark < q.illumination_low_pct) && ...
                      (pctBright < q.illumination_high_pct);
    illuminationScore = 1 - min(1, (pctDark + pctBright) / 100);
    if ~illuminationOK
        if pctDark >= q.illumination_low_pct
            issues{end+1} = 'underexposed'; %#ok<AGROW>
        end
        if pctBright >= q.illumination_high_pct
            issues{end+1} = 'overexposed'; %#ok<AGROW>
        end
    end

    adequate = isempty(issues);

    quality = struct( ...
        'adequate', adequate, ...
        'sharpness_score', round(sharpnessScore, 3), ...
        'illumination_score', round(illuminationScore, 3), ...
        'field_of_view_score', round(fovScore, 3), ...
        'issues', {issues}, ...
        'recapture_message', buildRecaptureMessage(issues) ...
    );
end

function msg = buildRecaptureMessage(issues)
    if isempty(issues)
        msg = '';
        return
    end
    messages = containers.Map( ...
        {'resolution_too_low', 'image_too_blurry', 'underexposed', ...
         'overexposed', 'incomplete_field_of_view'}, ...
        {'Image resolution is too low. Please recapture at higher resolution.', ...
         'Image is out of focus. Please hold the camera steady and retake.', ...
         'Image is too dark. Please improve lighting and retake.', ...
         'Image is overexposed/glare present. Reduce flash intensity and retake.', ...
         'Retina is not fully in frame. Recenter and retake.'});
    parts = cellfun(@(k) messages(k), issues, 'UniformOutput', false);
    msg = strjoin(parts, ' ');
end
