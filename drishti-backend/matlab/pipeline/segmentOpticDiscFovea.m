function structures = segmentOpticDiscFovea(img)
%SEGMENTOPTICDISCFOVEA Localize the optic disc and fovea.
%   structures = segmentOpticDiscFovea(img)
%
%   Optic disc: brightest large connected region (classic fundus heuristic) —
%   fast, deterministic, and a reasonable baseline; swap in a trained detector
%   (imported via importPyTorchModel) for production accuracy if time allows.
%   Fovea: darkest region within a search radius from the disc, roughly
%   opposite the vessel convergence point (approximated here as 2.5 disc-radii
%   from disc center, along the horizontal meridian — refine with vessel
%   convergence in a later iteration).
%
%   Output struct:
%     disc_center [x y], disc_radius_px
%     fovea_center [x y]
%     disc_mask (logical HxW)

    gray = im2double(rgb2gray(img));
    [h, w, ~] = size(img);

    % Optic disc: top 2% brightest pixels, largest connected blob, smoothed
    smoothed = imgaussfilt(gray, 5);
    thresh = quantile(smoothed(:), 0.98);
    bw = smoothed >= thresh;
    bw = imopen(bw, strel('disk', 5));
    bw = bwareafilt(bw, 1);

    if any(bw(:))
        stats = regionprops(bw, 'Centroid', 'EquivDiameter');
        discCenter = stats(1).Centroid;
        discRadius = stats(1).EquivDiameter / 2;
    else
        % Fallback: assume disc near horizontal center, offset toward nasal side
        discCenter = [w * 0.35, h * 0.5];
        discRadius = h * 0.06;
        bw = false(h, w);
    end

    % Fovea: darkest point within an annulus 2-3.5 disc-radii from disc center,
    % on the temporal side (away from the disc's horizontal offset from image center)
    direction = sign(discCenter(1) - w / 2);
    if direction == 0, direction = -1; end
    searchCenter = discCenter + [direction * -2.5 * discRadius, 0];
    searchCenter(1) = max(1, min(w, searchCenter(1)));
    searchCenter(2) = max(1, min(h, searchCenter(2)));

    [X, Y] = meshgrid(1:w, 1:h);
    distFromSearch = sqrt((X - searchCenter(1)).^2 + (Y - searchCenter(2)).^2);
    searchMask = distFromSearch < discRadius * 1.5;

    darkVals = gray;
    darkVals(~searchMask) = Inf;
    [~, idx] = min(darkVals(:));
    [fy, fx] = ind2sub(size(gray), idx);
    foveaCenter = [fx, fy];

    structures = struct( ...
        'disc_center', discCenter, ...
        'disc_radius_px', discRadius, ...
        'fovea_center', foveaCenter, ...
        'disc_mask', bw ...
    );
end
