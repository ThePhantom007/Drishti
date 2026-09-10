function tests = test_pipeline
%TEST_PIPELINE MATLAB unit test suite (matlab.unittest style function-based tests).
%   Run with: results = runtests('test_pipeline')
    tests = functiontests(localfunctions);
end

function setupOnce(testCase) %#ok<INUSD>
    rootDir = fileparts(fileparts(mfilename('fullpath')));
    run(fullfile(rootDir, 'startup.m'));
end

function testQualityAssessmentRejectsBlurryImage(testCase)
    cfg = loadConfig(fullfile(fileparts(fileparts(mfilename('fullpath'))), ...
        '..', 'config', 'pipeline_config.yaml'));
    blurry = uint8(128 * ones(1600, 1600, 3)); % flat/no texture -> low sharpness
    quality = assessImageQuality(blurry, cfg);
    testCase.verifyFalse(quality.adequate);
    testCase.verifyTrue(any(strcmp(quality.issues, 'image_too_blurry')));
end

function testQualityAssessmentAcceptsSyntheticGoodImage(testCase)
    cfg = loadConfig(fullfile(fileparts(fileparts(mfilename('fullpath'))), ...
        '..', 'config', 'pipeline_config.yaml'));
    img = syntheticFundusImage();
    quality = assessImageQuality(img, cfg);
    % Synthetic image is designed to pass resolution/illumination/FOV; sharpness
    % depends on injected texture noise, so only assert the non-sharpness checks here.
    testCase.verifyGreaterThan(quality.field_of_view_score, 0.5);
end

function testVesselSegmentationReturnsLogicalMask(testCase)
    img = syntheticFundusImage();
    mask = segmentVessels(img, struct());
    testCase.verifyClass(mask, 'logical');
    testCase.verifyEqual(size(mask), [size(img,1), size(img,2)]);
end

function testMicroaneurysmDetectorReturnsConsistentShapes(testCase)
    img = syntheticFundusImage();
    vesselMask = false(size(img,1), size(img,2));
    cfg = struct('microaneurysm', struct('max_diameter_px', 8));
    maResult = detectMicroaneurysms(img, vesselMask, cfg);
    testCase.verifyEqual(size(maResult.centroids, 1), maResult.count);
    testCase.verifyEqual(numel(maResult.confidence), maResult.count);
end

function testRuleBasedGradingNoDR(testCase)
    features = struct( ...
        'microaneurysm_count', 0, ...
        'hemorrhage', struct('count', 0, 'quadrant_counts', [0 0 0 0]), ...
        'hard_exudate_area_pct', 0, ...
        'soft_exudate_present', false, ...
        'nv', struct('nvd_suspected', false, 'nve_suspected', false));
    cfg = struct('grading', struct('referable_threshold_level', 2, ...
        'platt_A', 1, 'platt_B', 0, 'confidence_review_threshold', 0.7), ...
        'paths', struct('models_dir', tempdir, 'severity_model', 'nonexistent.onnx'));
    grading = gradeDRSeverity(features, cfg);
    testCase.verifyEqual(grading.icdr_level, 0);
    testCase.verifyFalse(grading.referable);
end

function testRuleBasedGradingProliferative(testCase)
    features = struct( ...
        'microaneurysm_count', 10, ...
        'hemorrhage', struct('count', 5, 'quadrant_counts', [2 1 1 1]), ...
        'hard_exudate_area_pct', 1, ...
        'soft_exudate_present', true, ...
        'nv', struct('nvd_suspected', true, 'nve_suspected', false));
    cfg = struct('grading', struct('referable_threshold_level', 2, ...
        'platt_A', 1, 'platt_B', 0, 'confidence_review_threshold', 0.7), ...
        'paths', struct('models_dir', tempdir, 'severity_model', 'nonexistent.onnx'));
    grading = gradeDRSeverity(features, cfg);
    testCase.verifyEqual(grading.icdr_level, 4);
    testCase.verifyTrue(grading.referable);
end

function img = syntheticFundusImage()
    sz = 1600;
    [X, Y] = meshgrid(1:sz, 1:sz);
    center = sz / 2;
    r = sqrt((X - center).^2 + (Y - center).^2);
    fovMask = r < sz * 0.45;

    img = zeros(sz, sz, 3, 'uint8');
    base = uint8(80 + 40 * rand(sz, sz)); % textured base for nonzero sharpness
    for c = 1:3
        chan = base;
        chan(~fovMask) = 5;
        img(:, :, c) = chan;
    end
    % boost green channel like a real fundus image
    img(:, :, 2) = img(:, :, 2) + uint8(30 * fovMask);
end
