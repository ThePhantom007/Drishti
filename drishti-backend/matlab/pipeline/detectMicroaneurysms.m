function maResult = detectMicroaneurysms(img, vesselMask, cfg)
%DETECTMICROANEURYSMS Sub-pixel-scale microaneurysm (MA) candidate detection.
%   maResult = detectMicroaneurysms(img, vesselMask, cfg)
%
%   MAs are the earliest DR sign: tiny (~10-100um -> a handful of pixels at
%   typical fundus resolution) round, dark, isolated blobs in the green channel.
%   Pipeline: top-hat filtering to isolate small dark blobs -> exclude anything
%   overlapping the vessel mask (vessels are NOT MAs) -> circularity filter to
%   reject elongated fragments -> candidate list with sub-pixel centroids.
%
%   This candidate generator is intentionally high-recall / lower-precision by
%   design (per cfg.microaneurysm.candidate_sensitivity_bias) — false positives
%   here are cheap (they just get shown as low-weight evidence), false
%   negatives are costly (missed early-stage DR), so the pipeline is tuned to
%   over-detect and let gradeDRSeverity's learned classifier down-weight noise.
%
%   Output struct:
%     count            (int)
%     centroids        (Nx2 double, [x y] sub-pixel)
%     confidence       (Nx1 double, [0,1] per-candidate)
%     mask             (logical HxW, union of candidate regions)

    green = im2double(img(:, :, 2));
    greenInv = imcomplement(green);

    % Top-hat with small disk isolates blobs smaller than the structuring element
    if isfield(cfg, 'microaneurysm') && isfield(cfg.microaneurysm, 'max_diameter_px')
        maxDiam = cfg.microaneurysm.max_diameter_px;
    else
        maxDiam = 8;
    end
    se = strel('disk', maxDiam);
    topHat = imtophat(greenInv, se);
    topHat = mat2gray(topHat);

    bw = imbinarize(topHat, graythresh(topHat) * 0.7);
    bw = bw & ~imdilate(vesselMask, strel('disk', 2));  % exclude vessel overlap
    bw = bwareaopen(bw, 2);

    cc = bwconncomp(bw);
    stats = regionprops(cc, topHat, 'Centroid', 'Area', 'Eccentricity', 'MeanIntensity');

    keep = false(numel(stats), 1);
    for i = 1:numel(stats)
        isRoundEnough = stats(i).Eccentricity < 0.85;   % reject elongated (likely vessel fragments)
        isSmallEnough = stats(i).Area <= pi * (maxDiam/2)^2 * 1.5;
        keep(i) = isRoundEnough && isSmallEnough;
    end
    stats = stats(keep);

    n = numel(stats);
    centroids = reshape([stats.Centroid], 2, n)';
    confidence = arrayfun(@(s) min(1, s.MeanIntensity * 1.3), stats);

    candidateMask = false(size(bw));
    if n > 0
        candidateMask = bw & ~imdilate(vesselMask, strel('disk', 2));
    end

    maResult = struct( ...
        'count', n, ...
        'centroids', centroids, ...
        'confidence', confidence, ...
        'mask', candidateMask ...
    );
end
