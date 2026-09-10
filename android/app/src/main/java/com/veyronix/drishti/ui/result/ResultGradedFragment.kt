package com.veyronix.drishti.ui.result

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.veyronix.drishti.R
import com.veyronix.drishti.data.SessionManager
import com.veyronix.drishti.databinding.FragmentResultGradedBinding
import com.veyronix.drishti.util.consumeStatusBarTopInset

/**
 * Result view for a graded screening. Fields here map 1:1 onto the /api/screen "graded"
 * response: grading.icdr_level/icdr_label/referable/confidence/requires_human_review,
 * quality.*, lesions.*, report.summary_text, report.audio_url (via language),
 * report.pdf_url.
 *
 * The whole screen is driven off one [icdrLevel] (0-4) via [SeverityPalette] — the halo,
 * badge circle, icon, grade text, referable pill, hero card border, and summary accent
 * all read from the same severity source of truth, so the color always matches the
 * grade wherever it appears on screen.
 *
 * DEMO STUB: populated with the exact sample payload from docs/api_contract.md so the
 * screen is meaningful in a walkthrough video.
 * TODO: replace populateMockResult() with real data from your ViewModel (fetched via
 * screeningId nav arg), and wire playAudioButton to GET /api/reports/{id}/audio and
 * viewReportButton to GET /api/reports/{id}/report.pdf.
 */
class ResultGradedFragment : Fragment() {

    private var _binding: FragmentResultGradedBinding? = null
    private val binding get() = _binding!!
    private var showingHeatmap = false

    /** One entry per ICDR level (0=No DR .. 4=Proliferative DR). */
    private data class SeverityPalette(
        val solidColor: Int,
        val haloColor: Int,
        val chipBackground: Int,
        val icon: Int
    )

    private fun severityPalette(icdrLevel: Int): SeverityPalette = when (icdrLevel) {
        0 -> SeverityPalette(R.color.status_no_dr, R.color.chip_glass_no_dr, R.drawable.bg_chip_no_dr, R.drawable.ic_check_circle)
        1 -> SeverityPalette(R.color.status_mild, R.color.chip_glass_mild, R.drawable.bg_chip_mild, R.drawable.ic_warning)
        2 -> SeverityPalette(R.color.status_moderate, R.color.chip_glass_moderate, R.drawable.bg_chip_moderate, R.drawable.ic_warning)
        3 -> SeverityPalette(R.color.status_severe, R.color.chip_glass_severe, R.drawable.bg_chip_severe, R.drawable.ic_error_circle)
        else -> SeverityPalette(R.color.status_proliferative, R.color.chip_glass_proliferative, R.drawable.bg_chip_proliferative, R.drawable.ic_error_circle)
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentResultGradedBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding.toolbar.consumeStatusBarTopInset()

        binding.toolbar.setNavigationOnClickListener { findNavController().navigateUp() }
        populateMockResult()

        binding.toggleHeatmapButton.setOnClickListener { toggleHeatmap() }
        binding.playAudioButton.setOnClickListener {
            // TODO: stream/play GET /api/reports/{id}/audio?lang=... ; handle 503 as
            // "feature temporarily unavailable", not a hard error
        }
        binding.viewReportButton.setOnClickListener {
            // TODO: open/download GET /api/reports/{id}/report.pdf
        }
        binding.doneButton.setOnClickListener {
            findNavController().navigate(R.id.action_resultGraded_to_home)
        }
    }

    private fun populateMockResult() {
        val ctx = requireContext()

        // DEMO STUB — mirrors the sample "graded" payload in docs/api_contract.md.
        val icdrLevel = 2
        val icdrLabel = "Moderate NPDR"
        val referable = true
        val requiresHumanReview = false
        val confidence = 0.88
        val sharpnessScore = 0.82
        val illuminationScore = 0.91
        val fieldOfViewScore = 0.95
        val microaneurysmCount = 14
        val hemorrhageCount = 3
        val hardExudateAreaPct = 1.2
        val softExudatePresent = false
        val neovascularizationDetected = false
        val processingTimeMs = 1840L

        val palette = severityPalette(icdrLevel)
        val color = ctx.getColor(palette.solidColor)

        binding.pendingReviewBanner.visibility = if (requiresHumanReview) View.VISIBLE else View.GONE

        // Hero: halo + badge circle + icon + grade text + pill, all from one palette
        binding.haloCircle.backgroundTintList = android.content.res.ColorStateList.valueOf(ctx.getColor(palette.haloColor))
        binding.badgeCircle.backgroundTintList = android.content.res.ColorStateList.valueOf(color)
        binding.badgeIcon.setImageResource(palette.icon)
        binding.icdrLabel.text = icdrLabel
        binding.icdrLabel.setTextColor(color)
        binding.statusBadge.setBackgroundResource(palette.chipBackground)
        binding.statusBadge.setTextColor(color)
        binding.statusBadge.text = if (referable) getString(R.string.status_referred_label) else getString(R.string.status_graded_label)
        binding.confidenceText.text = getString(R.string.confidence_format, (confidence * 100).toInt())
        binding.heroCard.strokeColor = color
        binding.summaryAccent.setBackgroundColor(color)

        binding.patientEyeLabel.text = "Ramesh Kumar · Right Eye (OD)"
        binding.screenedByLabel.text = getString(R.string.screened_by_format, SessionManager.workerName)
        binding.summaryText.text =
            "Moderate NPDR detected (ICDR level 2). Referable — recommend ophthalmologist follow-up within 3 months."

        // Quality Check
        binding.sharpnessValue.text = "${(sharpnessScore * 100).toInt()}%"
        binding.illuminationValue.text = "${(illuminationScore * 100).toInt()}%"
        binding.fieldOfViewValue.text = "${(fieldOfViewScore * 100).toInt()}%"

        // Lesion Analysis
        binding.microaneurysmsValue.text = microaneurysmCount.toString()
        binding.hemorrhagesValue.text = hemorrhageCount.toString()
        binding.hardExudateValue.text = "$hardExudateAreaPct%"
        binding.softExudateValue.text = if (softExudatePresent) "Yes" else "No"
        binding.neovascularizationValue.text = if (neovascularizationDetected) "Yes" else "No"

        binding.audioLanguageLabel.text = "Hindi (हिन्दी)"

        binding.footerText.text = getString(
            R.string.screened_footer_format,
            "2 Sep 2026, 10:15 AM",
            processingTimeMs / 1000f
        )

        applyImageMode(animate = false)
    }

    /**
     * DEMO STUB: there's no real annotated photo or Grad-CAM output yet, so this just
     * swaps a placeholder background + label between the two states with a short
     * crossfade. TODO: once explainability.annotated_image_url /
     * explainability.gradcam_image_url are wired in, load those into an actual
     * ImageView here instead of toggling a background drawable.
     */
    private fun toggleHeatmap() {
        showingHeatmap = !showingHeatmap
        applyImageMode(animate = true)
    }

    private fun applyImageMode(animate: Boolean) {
        val backgroundRes = if (showingHeatmap) R.drawable.bg_heatmap_dummy else R.drawable.bg_annotated_dummy
        val labelText = if (showingHeatmap) getString(R.string.label_heatmap_view) else getString(R.string.label_original_capture)
        val buttonText = if (showingHeatmap) getString(R.string.btn_show_original) else getString(R.string.btn_show_heatmap)

        fun apply() {
            binding.annotatedImage.setBackgroundResource(backgroundRes)
            binding.imageModeLabel.text = labelText
            binding.toggleHeatmapButton.text = buttonText
        }

        if (!animate) {
            apply()
            return
        }

        binding.annotatedImage.animate().alpha(0f).setDuration(120).withEndAction {
            apply()
            binding.annotatedImage.animate().alpha(1f).setDuration(180).start()
        }.start()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
