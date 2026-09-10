package com.veyronix.drishti.ui.processing

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.os.bundleOf
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.veyronix.drishti.R
import com.veyronix.drishti.databinding.FragmentProcessingBinding
import com.veyronix.drishti.util.NotificationHelper

/**
 * Shown while POST /api/screen is in flight. On response, route to either
 * ResultGradedFragment ("status": "graded") or ResultRejectedFragment
 * ("status": "rejected") per the API contract.
 *
 * DEMO STUB: auto-advances to the graded result after a short delay so the flow is
 * clickable end-to-end for the video prototype.
 * TODO: replace with observing your ViewModel's upload result (LiveData/StateFlow) and
 * navigate based on the real `status` field. Wire cancelButton to actually cancel the
 * in-flight request.
 */
class ProcessingFragment : Fragment() {

    private var _binding: FragmentProcessingBinding? = null
    private val binding get() = _binding!!
    private val handler = Handler(Looper.getMainLooper())
    private val advanceToResult = Runnable {
        if (isAdded) {
            // DEMO STUB always resolves "graded" — swap for branching on the real
            // response status once the network layer is wired in.
            NotificationHelper.notifyScreeningGraded(requireContext(), "Moderate NPDR")
            findNavController().navigate(
                R.id.action_processing_to_resultGraded,
                bundleOf("screeningId" to "mock-screening-id")
            )
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentProcessingBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding.cancelButton.setOnClickListener {
            handler.removeCallbacks(advanceToResult)
            findNavController().navigateUp()
        }

        handler.postDelayed(advanceToResult, 1800)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        handler.removeCallbacks(advanceToResult)
        _binding = null
    }
}
