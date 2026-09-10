function hemResult = classifyHemorrhages(img, vesselMask, discMask)
%CLASSIFYHEMORRHAGES Detect and classify retinal hemorrhages.
%   hemResult = classifyHemorrhages(img, vesselMask, discMask)
%
%   Hemorrhages are dark red blob/flame-shaped lesions, larger than
%   microaneurysms but distinguished from vessels by lack of elongated
%   connectivity. Classified into "dot-and-blot" (round, within inner retinal
%   layers -> NPDR marker) vs "flame-shaped" (elongated along nerve fiber
%   layer -> also NPDR, but morphologically distinct and often an earlier
%   severe-NPDR indicator). This split matters because ICDR 4-2-1 rule counts
%   hemorrhages by quadrant, and flame shape can indicate more acute disease.
%
%   Output struct:
%     count (int), dot_blot_count (int), flame_count (int)
%     quadrant_counts (1x4 int, hemorrhages per fundus quadrant)
%     mask (logical HxW)

    green = im2double(img(:, :, 2));
    greenInv = imcomplement(adapthisteq(green));

    excludeZone = imdilate(discMask, strel('disk', 10)) | imdilate(vesselMask, strel('disk', 1));

    darkBlobs = imtophat(greenInv, strel('disk', 20));
    darkBlobs = mat2gray(darkBlobs);
    bw = imbinarize(darkBlobs, graythresh(darkBlobs) * 0.85) & ~excludeZone;
    bw = bwareaopen(bw, 6);   % larger min-size than MAs -> distinguishes from MA detector

    cc = bwconncomp(bw);
    stats = regionprops(cc, 'Centroid', 'Area', 'Eccentricity', 'Orientation', 'BoundingBox');

    n = numel(stats);
    isFlame = false(n, 1);
    for i = 1:n
        isFlame(i) = stats(i).Eccentricity > 0.85;  % elongated -> flame-shaped
    end

    [h, w] = size(bw);
    quadrantCounts = zeros(1, 4);
    for i = 1:n
        c = stats(i).Centroid;
        qx = c(1) > w/2;
        qy = c(2) > h/2;
        qIdx = qy*2 + qx + 1; % 1=TL,2=TR,3=BL,4=BR
        quadrantCounts(qIdx) = quadrantCounts(qIdx) + 1;
    end

    hemResult = struct( ...
        'count', n, ...
        'dot_blot_count', sum(~isFlame), ...
        'flame_count', sum(isFlame), ...
        'quadrant_counts', quadrantCounts, ...
        'mask', bw ...
    );
end
