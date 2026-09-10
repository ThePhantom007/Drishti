function enhanced = enhanceImage(img, cfg)
%ENHANCEIMAGE Adaptive enhancement for borderline-adequate fundus images.
%   enhanced = enhanceImage(img, cfg)
%
%   Applies (in order): illumination normalization (shade correction),
%   CLAHE contrast enhancement on the green channel (highest vessel/lesion
%   contrast in fundus photography), and non-local-means denoising.
%
%   Only called when assessImageQuality flags a borderline (but not rejected)
%   image — fully adequate images skip this to avoid unnecessary artifact
%   introduction.

    e = cfg.enhancement;

    % --- Illumination normalization (shade correction) ----------------------
    % Estimate slowly-varying illumination field via large-kernel Gaussian blur,
    % divide it out, then rescale — standard fundus preprocessing technique.
    imgD = im2double(img);
    illumField = imgaussfilt(imgD, size(img, 1) / 20);
    illumField = max(illumField, 0.05); % avoid divide-by-near-zero
    normalized = imgD ./ illumField;
    normalized = normalized ./ max(normalized(:));

    % --- CLAHE on green channel (best vessel/lesion contrast), recombine ----
    green = normalized(:, :, 2);
    greenEq = adapthisteq(green, ...
        'ClipLimit', e.clahe_clip_limit / 100, ...
        'NumTiles', e.clahe_tile_grid_size);

    enhanced3 = normalized;
    enhanced3(:, :, 2) = greenEq;

    % Apply the same tone adjustment proportionally to R/B to avoid color shift
    ratio = greenEq ./ max(green, 1e-3);
    enhanced3(:, :, 1) = min(1, normalized(:, :, 1) .* ratio);
    enhanced3(:, :, 3) = min(1, normalized(:, :, 3) .* ratio);

    % --- Denoise --------------------------------------------------------------
    switch e.denoise_method
        case 'nlm'
            for c = 1:3
                enhanced3(:, :, c) = imnlmfilt(enhanced3(:, :, c));
            end
        otherwise
            enhanced3 = imgaussfilt(enhanced3, 0.5); % mild fallback
    end

    enhanced = im2uint8(enhanced3);
end
