package com.veyronix.drishti.ui.history

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.os.bundleOf
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.veyronix.drishti.R
import com.veyronix.drishti.databinding.FragmentPatientHistoryBinding
import com.veyronix.drishti.data.model.ScreeningHistoryItem
import com.veyronix.drishti.data.model.Severity
import com.veyronix.drishti.ui.adapter.ScreeningHistoryAdapter
import com.veyronix.drishti.util.consumeStatusBarTopInset

/**
 * Full patient record + screening history (most-recent-first), backing GET
 * /api/patients/{patient_id} or the lighter GET /api/patients/{patient_id}/screenings.
 *
 * TODO: load real patient + history via ViewModel keyed on the "patientId" nav arg.
 */
class PatientHistoryFragment : Fragment() {

    private var _binding: FragmentPatientHistoryBinding? = null
    private val binding get() = _binding!!

    /** DEMO STUB: mirrors HomeFragment.mockPatients() so tapping different queue rows shows different (still fake) details here. */
    private data class MockPatientInfo(val name: String, val details: String)
    private val mockDirectory = mapOf(
        "p1" to MockPatientInfo("Ramesh Kumar", "54 yrs · M · Nanded · PHC-NAN-014 · Hindi"),
        "p2" to MockPatientInfo("Sunita Devi", "41 yrs · F · Nanded · PHC-NAN-014 · Marathi"),
        "p3" to MockPatientInfo("Walk-in patient", "— yrs · — · Nanded · PHC-NAN-014 · Hindi"),
        "p4" to MockPatientInfo("Lakshmi Bai", "62 yrs · F · Hingoli · PHC-HIN-002 · Marathi"),
        "p5" to MockPatientInfo("Vijay Singh", "47 yrs · M · Nanded · PHC-NAN-014 · Hindi"),
        "p6" to MockPatientInfo("Anita Kumari", "36 yrs · F · Parbhani · PHC-PAR-009 · Hindi")
    )

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentPatientHistoryBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding.toolbar.consumeStatusBarTopInset()

        val patientId = arguments?.getString("patientId")
        val info = mockDirectory[patientId] ?: MockPatientInfo(
            "Walk-in patient", "— yrs · — · Nanded · PHC-NAN-014 · Hindi"
        )

        binding.toolbar.setNavigationOnClickListener { findNavController().navigateUp() }
        binding.patientNameText.text = info.name
        binding.patientDetailsText.text = info.details

        val adapter = ScreeningHistoryAdapter { item ->
            findNavController().navigate(
                R.id.action_history_to_resultGraded,
                bundleOf("screeningId" to item.screeningId)
            )
        }
        binding.screeningHistoryList.layoutManager = LinearLayoutManager(requireContext())
        binding.screeningHistoryList.adapter = adapter
        adapter.submitList(mockHistory())

        binding.newScreeningFab.setOnClickListener {
            findNavController().navigate(
                R.id.action_history_to_capture,
                bundleOf("patientId" to patientId, "eye" to "OD")
            )
        }
    }

    private fun mockHistory() = listOf(
        ScreeningHistoryItem("s1", "2 Sep 2026 · Right Eye (OD)", "14 microaneurysms, 3 hemorrhages", "Moderate NPDR", Severity.MODERATE),
        ScreeningHistoryItem("s2", "14 May 2026 · Right Eye (OD)", "6 microaneurysms, 0 hemorrhages", "Mild NPDR", Severity.MILD),
        ScreeningHistoryItem("s3", "2 Feb 2026 · Left Eye (OS)", "0 microaneurysms, 0 hemorrhages", "No DR", Severity.NO_DR),
        ScreeningHistoryItem("s4", "20 Oct 2025 · Right Eye (OD)", "31 microaneurysms, 12 hemorrhages", "Severe NPDR", Severity.SEVERE)
    )

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
