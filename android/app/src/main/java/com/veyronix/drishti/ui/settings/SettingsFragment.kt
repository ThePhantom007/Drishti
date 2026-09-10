package com.veyronix.drishti.ui.settings

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.veyronix.drishti.R
import com.veyronix.drishti.data.SessionManager
import com.veyronix.drishti.databinding.FragmentSettingsBinding
import com.veyronix.drishti.util.consumeStatusBarTopInset

/**
 * TODO: wire languageRow to a language picker (persist via your Repository / DataStore),
 * facilityRow to a real facility_id/district for this device (currently dummy data).
 */
class SettingsFragment : Fragment() {

    private var _binding: FragmentSettingsBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentSettingsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding.toolbar.consumeStatusBarTopInset()
        binding.toolbar.setNavigationOnClickListener { findNavController().navigateUp() }

        binding.workerNameValue.text = SessionManager.workerName
        binding.currentLanguageValue.text = "Hindi"
        binding.facilityValue.text = "PHC-NAN-014 · Nanded"

        binding.logoutRow.setOnClickListener {
            SessionManager.logout()
            findNavController().navigate(R.id.action_settings_to_login)
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
