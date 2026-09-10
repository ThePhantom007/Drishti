function report = generateReport(imgPath, quality, grading, lesions, camOverlay, cfg)
%GENERATEREPORT Build the annotated report (JSON + PDF) for a screening result.
%   report = generateReport(imgPath, quality, grading, lesions, camOverlay, cfg)
%
%   Designed around the "<30 second ophthalmologist review" requirement: the
%   summary leads with the referral decision and confidence, followed by the
%   specific lesion evidence that drove the grade (not just a bare class
%   label) — this is what makes the explainability clinically actionable
%   rather than a black-box heatmap alone.
%
%   Output struct matches the shape documented in docs/api_contract.md
%   under "report".

    reportId = ioHelpers('timestampId');
    outDir = fullfile(cfg.paths.reports_out_dir, reportId);
    ioHelpers('ensureDir', outDir);

    summary = buildSummaryText(grading, lesions);

    heatmapPath = fullfile(outDir, 'heatmap.png');
    imwrite(camOverlay, heatmapPath);

    annotatedPath = fullfile(outDir, 'annotated.png');
    annotated = buildAnnotatedImage(imgPath, lesions);
    imwrite(annotated, annotatedPath);

    pdfPath = fullfile(outDir, 'report.pdf');
    writeReportPDF(pdfPath, reportId, quality, grading, lesions, summary, annotatedPath, heatmapPath);

    report = struct( ...
        'report_id', reportId, ...
        'pdf_url', pdfPath, ...
        'heatmap_path', heatmapPath, ...
        'annotated_path', annotatedPath, ...
        'summary_text', summary, ...
        'language', 'en' ...
    );
end

function summary = buildSummaryText(grading, lesions)
    if grading.referable
        action = sprintf('Referable — recommend ophthalmologist follow-up %s.', ...
            urgencyPhrase(grading.icdr_level));
    else
        action = 'Not referable — recommend routine annual re-screening.';
    end

    evidenceBits = {};
    if lesions.microaneurysm_count > 0
        evidenceBits{end+1} = sprintf('%d microaneurysm(s)', lesions.microaneurysm_count); %#ok<AGROW>
    end
    if lesions.hemorrhage.count > 0
        evidenceBits{end+1} = sprintf('%d hemorrhage(s)', lesions.hemorrhage.count); %#ok<AGROW>
    end
    if lesions.hard_exudate_area_pct > 0
        evidenceBits{end+1} = sprintf('hard exudates covering %.1f%% of field', ...
            lesions.hard_exudate_area_pct); %#ok<AGROW>
    end
    if lesions.nv.nvd_suspected || lesions.nv.nve_suspected
        evidenceBits{end+1} = 'suspected neovascularization'; %#ok<AGROW>
    end

    if isempty(evidenceBits)
        evidenceStr = 'No significant lesions detected.';
    else
        evidenceStr = ['Evidence: ', strjoin(evidenceBits, ', '), '.'];
    end

    summary = sprintf('%s detected (ICDR level %d). %s %s', ...
        grading.icdr_label, grading.icdr_level, action, evidenceStr);
end

function phrase = urgencyPhrase(level)
    switch level
        case 2, phrase = 'within 3 months';
        case 3, phrase = 'within 1 month';
        case 4, phrase = 'urgently, within 1 week';
        otherwise, phrase = 'at routine interval';
    end
end

function annotated = buildAnnotatedImage(imgPath, lesions)
    img = imread(imgPath);
    annotated = img;
    if lesions.microaneurysm_count > 0 && ~isempty(lesions.microaneurysm_centroids)
        annotated = insertMarker(annotated, lesions.microaneurysm_centroids, ...
            'o', 'Color', 'yellow', 'Size', 3);
    end
    if any(lesions.hemorrhage.mask(:))
        annotated = drawLesionBoundaries(annotated, lesions.hemorrhage.mask, 'red');
    end
    if any(lesions.hard_exudate_mask(:))
        annotated = drawLesionBoundaries(annotated, lesions.hard_exudate_mask, 'cyan');
    end
end

function annotated = drawLesionBoundaries(img, mask, color)
%DRAWLESIONBOUNDARIES Outline each connected lesion region as a polygon.
%   Skips any boundary trace with fewer than 3 points -- insertShape requires
%   at least 3 vertices for a polygon, and tiny (near single-pixel) lesion
%   blobs can occasionally produce degenerate boundary traces that would
%   otherwise crash report generation entirely over one small artifact rather
%   than just skipping that one shape.
    annotated = img;
    boundaries = bwboundaries(mask);
    for i = 1:numel(boundaries)
        if size(boundaries{i}, 1) < 3
            continue
        end
        annotated = insertShape(annotated, 'Polygon', ...
            reshape(fliplr(boundaries{i})', 1, []), 'Color', color, 'LineWidth', 1);
    end
end

function writeReportPDF(pdfPath, reportId, quality, grading, lesions, summary, annotatedPath, heatmapPath) %#ok<INUSD>
    % Simple, dependency-light PDF assembly via a figure export — swap for
    % report.Report/DOM API (Report Generator toolbox) for a more polished
    % layout if that toolbox is available in your license.
    fig = figure('Visible', 'off', 'Position', [0 0 900 1100]);
    tiledlayout(fig, 4, 2, 'TileSpacing', 'compact');

    nexttile([1 2]);
    text(0, 0.5, sprintf('DR Screening Report — %s', reportId), 'FontSize', 16, 'FontWeight', 'bold');
    axis off;

    nexttile;
    imshow(imread(annotatedPath));
    title('Annotated lesions');

    nexttile;
    imshow(imread(heatmapPath));
    title('Grad-CAM attention');

    nexttile([1 2]);
    text(0, 0.8, summary, 'FontSize', 11, 'Interpreter', 'none');
    axis off;

    nexttile([1 2]);
    metaText = sprintf(['Quality: sharpness=%.2f illum=%.2f FOV=%.2f\n' ...
        'Confidence: %.1f%%   Requires review: %d\n' ...
        'MA=%d  Hemorrhages=%d  Hard exudate=%.1f%%  Soft exudate=%d  NV=%d'], ...
        quality.sharpness_score, quality.illumination_score, quality.field_of_view_score, ...
        grading.model_confidence * 100, grading.requires_human_review, ...
        lesions.microaneurysm_count, lesions.hemorrhage.count, lesions.hard_exudate_area_pct, ...
        lesions.soft_exudate_present, (lesions.nv.nvd_suspected || lesions.nv.nve_suspected));
    text(0, 0.5, metaText, 'FontSize', 9, 'Interpreter', 'none');
    axis off;

    exportgraphics(fig, pdfPath, 'ContentType', 'vector');
    close(fig);
end
