function vesselMask = segmentVessels(img, cfg)
%SEGMENTVESSELS Binary vessel map via multi-scale matched filtering.
%   vesselMask = segmentVessels(img, cfg)
%
%   Classical approach (Chaudhuri-style matched Gaussian filters at multiple
%   scales/orientations) on the green channel, which has the highest
%   vessel-background contrast in fundus photography. Deterministic and
%   dependency-free — a trained U-Net (via importPyTorchModel + cfg vessel_model)
%   can be swapped in without changing this function's signature.
%
%   Output: logical HxW vessel mask.

    green = im2double(img(:, :, 2));
    green = imcomplement(adapthisteq(green)); % vessels -> bright after inversion

    orientations = 0:15:165;   % 12 orientations
    scales = [1, 2, 3];        % multi-scale to catch thin + thick vessels

    response = zeros(size(green));
    for s = scales
        kernelLen = 9 * s;
        for theta = orientations
            kernel = matchedGaussianKernel(kernelLen, 1.5 * s, theta);
            filtered = imfilter(green, kernel, 'replicate');
            response = max(response, filtered);
        end
    end

    response = mat2gray(response);
    if nargin > 1 && isfield(cfg, 'vessel_threshold')
        thresh = cfg.vessel_threshold;
    else
        thresh = graythresh(response) * 0.9; % slightly permissive for thin vessels
    end

    vesselMask = imbinarize(response, thresh);
    vesselMask = bwareaopen(vesselMask, 15);  % remove speckle noise
    vesselMask = imclose(vesselMask, strel('disk', 1));
end

function kernel = matchedGaussianKernel(len, sigma, thetaDeg)
%MATCHEDGAUSSIANKERNEL 1D Gaussian cross-section extruded along a line, rotated.
    halfLen = floor(len / 2);
    [x, y] = meshgrid(-halfLen:halfLen, -3:3);
    base = exp(-(y.^2) / (2 * sigma^2)) .* (abs(x) <= halfLen);
    base = base - mean(base(:)); % zero-mean so uniform regions don't respond
    kernel = imrotate(base, thetaDeg, 'bilinear', 'crop');
end
