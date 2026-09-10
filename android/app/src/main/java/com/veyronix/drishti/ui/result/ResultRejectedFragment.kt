package com.veyronix.drishti.ui.result

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.veyronix.drishti.R
import com.veyronix.drishti.databinding.FragmentResultRejectedBinding
import com.veyronix.drishti.util.consumeStatusBarTopInset

/**
 * Quality-gate-failed screen. Shows `recapture_message` and `quality.issues` verbatim
 * from the /api/screen "rejected" response so the field worker gets specific, actionable
 * feedback rather than a generic error.
 *
 * TODO: pass the real recaptureMessage + issues list via nav args / SavedStateHandle from
 * your ViewModel instead of the mock default below.
 */
class ResultRejectedFragment : Fragment() {

    private var _binding: FragmentResultRejectedBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentResultRejectedBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding.rootContainer.consumeStatusBarTopInset()

        val message = arguments?.getString("recaptureMessage")
            ?: "Image is out of focus. Please hold the camera steady and retake."
        binding.recaptureMessage.text = message

        binding.retakePhotoButton.setOnClickListener {
            findNavController().navigate(R.id.action_rejected_to_capture)
        }
        binding.cancelButton.setOnClickListener {
            findNavController().navigate(R.id.action_rejected_to_home)
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
