package com.veyronix.drishti.ui.capture

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.os.bundleOf
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.veyronix.drishti.R
import com.veyronix.drishti.databinding.FragmentCaptureBinding
import com.veyronix.drishti.util.consumeStatusBarTopInset

/**
 * Guided capture screen. [cameraPreview] is a plain placeholder View — swap it for a
 * CameraX PreviewView when wiring the real camera pipeline.
 *
 * Flow: shutter tap -> show reviewOverlay (retake/use photo) -> "Use Photo" calls
 * POST /api/screen (multipart: image, patient_id, eye, language) and navigates to
 * Processing while the request is in flight.
 *
 * TODO: CameraX capture-to-file, eye toggle -> "eye" form field, language from patient's
 * preferred_language, and the actual multipart upload live in your Repository/ViewModel.
 */
class CaptureFragment : Fragment() {

    private var _binding: FragmentCaptureBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentCaptureBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding.captureTopBar.consumeStatusBarTopInset()

        val patientId = arguments?.getString("patientId")
        val eye = arguments?.getString("eye") ?: "OD"

        binding.backButton.setOnClickListener { findNavController().navigateUp() }

        binding.shutterButton.setOnClickListener {
            // TODO: trigger CameraX ImageCapture.takePicture(...)
            binding.reviewOverlay.visibility = View.VISIBLE
        }

        binding.retakeButton.setOnClickListener {
            binding.reviewOverlay.visibility = View.GONE
        }

        binding.usePhotoButton.setOnClickListener {
            val selectedEye = if (binding.eyeToggleGroup.checkedButtonId == R.id.osButton) "OS" else eye
            // TODO: kick off ViewModel.submitScreening(patientId, selectedEye, imageFile)
            findNavController().navigate(
                R.id.action_capture_to_processing,
                bundleOf("patientId" to patientId, "eye" to selectedEye)
            )
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
