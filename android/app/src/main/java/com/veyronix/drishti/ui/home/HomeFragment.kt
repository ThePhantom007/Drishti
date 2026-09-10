package com.veyronix.drishti.ui.home

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.veyronix.drishti.R
import com.veyronix.drishti.databinding.FragmentHomeBinding
import com.veyronix.drishti.data.model.PatientListItem
import com.veyronix.drishti.data.model.ScreeningStatus
import com.veyronix.drishti.data.SessionManager
import com.veyronix.drishti.ui.adapter.PatientAdapter
import com.veyronix.drishti.util.consumeStatusBarTopInset

/**
 * "Today's Patients" queue — the screen the ASHA worker sees most often.
 * Single primary action: Scan New Patient. Sync status is always visible in the top bar.
 *
 * TODO: replace [mockPatients] with a HomeViewModel exposing LiveData/StateFlow backed by
 * your repository (local Room cache + GET /api/patients as needed). Wire swipeRefresh to
 * a real refresh call. Wire syncIndicator's text/count to your offline-sync repository.
 */
class HomeFragment : Fragment() {

    private var _binding: FragmentHomeBinding? = null
    private val binding get() = _binding!!

    private lateinit var adapter: PatientAdapter

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentHomeBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding.appBar.consumeStatusBarTopInset()

        adapter = PatientAdapter { patient ->
            findNavController().navigate(
                R.id.action_home_to_history,
                androidx.core.os.bundleOf("patientId" to patient.patientId)
            )
        }
        binding.patientList.layoutManager = LinearLayoutManager(requireContext())
        binding.patientList.adapter = adapter

        val mockPatients = mockPatients()
        adapter.submitList(mockPatients)
        binding.emptyState.visibility = if (mockPatients.isEmpty()) View.VISIBLE else View.GONE
        binding.patientList.visibility = if (mockPatients.isEmpty()) View.GONE else View.VISIBLE

        binding.greetingText.text = getString(R.string.home_greeting, SessionManager.workerName)

        // TODO: replace with a real pending-sync count from the offline queue repository
        val pendingSyncCount = 2
        binding.syncStatusText.text = if (pendingSyncCount > 0) {
            getString(R.string.sync_pending_format, pendingSyncCount)
        } else {
            getString(R.string.sync_all_uploaded)
        }

        binding.scanNewPatientFab.setOnClickListener {
            findNavController().navigate(R.id.action_home_to_registration)
        }
        binding.syncIndicator.setOnClickListener {
            findNavController().navigate(R.id.action_home_to_syncQueue)
        }
        binding.settingsButton.setOnClickListener {
            findNavController().navigate(R.id.action_home_to_settings)
        }
        binding.swipeRefresh.setOnRefreshListener {
            // TODO: trigger real refresh via ViewModel; stub-stop for now
            binding.swipeRefresh.isRefreshing = false
        }
    }

    private fun mockPatients() = listOf(
        PatientListItem("p1", "Ramesh Kumar", "54 yrs · M", "10:15 AM", ScreeningStatus.REFERRED),
        PatientListItem("p2", "Sunita Devi", "41 yrs · F", "10:42 AM", ScreeningStatus.GRADED),
        PatientListItem("p3", "Walk-in patient", "— yrs · —", "11:03 AM", ScreeningStatus.PENDING),
        PatientListItem("p4", "Lakshmi Bai", "62 yrs · F", "11:20 AM", ScreeningStatus.GRADED),
        PatientListItem("p5", "Vijay Singh", "47 yrs · M", "11:48 AM", ScreeningStatus.PENDING),
        PatientListItem("p6", "Anita Kumari", "36 yrs · F", "12:05 PM", ScreeningStatus.REFERRED)
    )

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
