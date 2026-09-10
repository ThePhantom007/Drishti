function exudateResult = segmentExudates(img, discMask)
%SEGMENTEXUDATES Hard and soft exudate segmentation.
%   exudateResult = segmentExudates(img, discMask)
%
%   Hard exudates: bright, sharp-edged, high-contrast lipid deposits — detected
%   via adaptive thresholding on the green channel after disc exclusion (disc
%   is also bright and would otherwise dominate).
%   Soft exudates (cotton wool spots): brighter but blurrier/lower-contrast,
%   larger, fuzzy-edged — detected via a lower-frequency band-pass + lower
%   edge-sharpness threshold than hard exudates.
%
%   Output struct:
%     hard_exudate_mask (logical HxW)
%     hard_exudate_area_pct (double, % of retinal FOV)
%     soft_exudate_present (logical)
%     soft_exudate_mask (logical HxW)

    green = im2double(img(:, :, 2));
    greenEq = adapthisteq(green);

    excludeZone = imdilate(discMask, strel('disk', 15));

    % --- Hard exudates: high local contrast + high brightness ---------------
    localMean = imgaussfilt(greenEq, 15);
    contrastMap = greenEq - localMean;
    hardCandidates = (contrastMap > 0.15) & (greenEq > 0.55) & ~excludeZone;
    hardCandidates = bwareaopen(hardCandidates, 4);
    hardCandidates = imclose(hardCandidates, strel('disk', 1));

    % Edge sharpness filter: hard exudates have crisp boundaries (high gradient
    % magnitude at their border), distinguishing them from soft exudates.
    [gx, gy] = gradient(greenEq);
    gradMag = sqrt(gx.^2 + gy.^2);
    edgeStats = regionprops(hardCandidates, gradMag, 'MeanIntensity', 'PixelIdxList');
    hardMask = false(size(hardCandidates));
    for i = 1:numel(edgeStats)
        if edgeStats(i).MeanIntensity > 0.03  % sharp-edged -> keep as "hard"
            hardMask(edgeStats(i).PixelIdxList) = true;
        end
    end

    fovMask = ~excludeZone; % rough proxy for gradable retinal area
    hardAreaPct = 100 * sum(hardMask(:)) / max(1, sum(fovMask(:)));

    % --- Soft exudates: bright, low-frequency, fuzzy blobs -------------------
    lowFreq = imgaussfilt(greenEq, 8) - imgaussfilt(greenEq, 20);
    softCandidates = (lowFreq > 0.08) & (imgaussfilt(greenEq, 8) > 0.5) & ~excludeZone;
    softCandidates = bwareaopen(softCandidates, 30);   % soft exudates are larger, blob-like
    softMask = softCandidates & ~hardMask;

    exudateResult = struct( ...
        'hard_exudate_mask', hardMask, ...
        'hard_exudate_area_pct', round(hardAreaPct, 3), ...
        'soft_exudate_present', any(softMask(:)), ...
        'soft_exudate_mask', softMask ...
    );
end
