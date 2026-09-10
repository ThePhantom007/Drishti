function nvResult = detectNeovascularization(vesselMask, discStruct)
%DETECTNEOVASCULARIZATION Flag abnormal new vessel growth (PDR marker).
%   nvResult = detectNeovascularization(vesselMask, discStruct)
%
%   Neovascularization (NV) is the hallmark of proliferative DR (ICDR level 4):
%   fine, tortuous, disorganized new vessels, typically either on/near the
%   optic disc (NVD) or elsewhere on the retina (NVE). Heuristic: NV regions
%   show abnormally high local vessel-branching density and higher tortuosity
%   (path length vs. straight-line distance) than the surrounding normal
%   vascular tree. This is a coarse screen — flags candidate regions for the
%   confidence-review path rather than claiming definitive NV diagnosis, since
%   this is the highest-stakes / hardest-to-get-right lesion category.
%
%   Output struct:
%     nvd_suspected (logical) - near optic disc
%     nve_suspected (logical) - elsewhere
%     suspected_regions (Nx4 double, bounding boxes [x y w h])
%     tortuosity_score (double, overall vascular tortuosity index)

    skel = bwskel(vesselMask, 'MinBranchLength', 5);
    branchPoints = bwmorph(skel, 'branchpoints');

    % Local branch-point density map (branches per unit area) — NV regions
    % show density well above the retina-wide baseline.
    density = imgaussfilt(double(branchPoints), 15) * 1000;
    baseline = median(density(density > 0));
    hotspotMask = density > (baseline * 2.5);
    hotspotMask = bwareaopen(hotspotMask, 20);

    cc = bwconncomp(hotspotMask);
    stats = regionprops(cc, 'BoundingBox', 'Centroid');
    n = numel(stats);

    discCenter = discStruct.disc_center;
    discRadius = discStruct.disc_radius_px;

    nvdFlag = false;
    nveFlag = false;
    boxes = zeros(n, 4);
    for i = 1:n
        boxes(i, :) = stats(i).BoundingBox;
        d = norm(stats(i).Centroid - discCenter);
        if d < discRadius * 2
            nvdFlag = true;
        else
            nveFlag = true;
        end
    end

    % Overall tortuosity index: skeleton arc length vs. endpoint straight-line
    % distance, averaged over branches — elevated in NV and in general severe NPDR.
    tortuosity = estimateTortuosity(skel);

    nvResult = struct( ...
        'nvd_suspected', nvdFlag, ...
        'nve_suspected', nveFlag, ...
        'suspected_regions', boxes, ...
        'tortuosity_score', tortuosity ...
    );
end

function score = estimateTortuosity(skel)
    cc = bwconncomp(skel);
    if cc.NumObjects == 0
        score = 0;
        return
    end
    ratios = zeros(cc.NumObjects, 1);
    for i = 1:cc.NumObjects
        [rows, cols] = ind2sub(size(skel), cc.PixelIdxList{i});
        if numel(rows) < 5
            ratios(i) = 1;
            continue
        end
        arcLen = numel(rows); % approx: pixel count along thin skeleton path
        straightLen = norm([rows(1) cols(1)] - [rows(end) cols(end)]);
        ratios(i) = arcLen / max(straightLen, 1);
    end
    score = mean(ratios);
end
