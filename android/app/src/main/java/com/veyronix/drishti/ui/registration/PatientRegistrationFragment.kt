package com.veyronix.drishti.ui.registration

import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.core.os.bundleOf
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.veyronix.drishti.R
import com.veyronix.drishti.databinding.FragmentPatientRegistrationBinding
import com.veyronix.drishti.data.model.SUPPORTED_LANGUAGES
import com.veyronix.drishti.util.NotificationHelper
import com.veyronix.drishti.util.consumeStatusBarTopInset

/**
 * Short registration form — kept minimal per the design brief (a long form is a real
 * adoption barrier in the field). "Skip" supports the walk-in flow where /api/screen
 * auto-creates a minimal patient record.
 *
 * TODO: wire registerContinueButton to a RegistrationViewModel that calls
 * POST /api/patients via your repository, then navigate with the returned patient_id.
 */
class PatientRegistrationFragment : Fragment() {

    private var _binding: FragmentPatientRegistrationBinding? = null
    private val binding get() = _binding!!
    private val pickImage = registerForActivityResult(ActivityResultContracts.PickVisualMedia()){uri->
        if(uri != null){
            Log.d("SELECTED_IMAGE_URI", uri.toString())
            findNavController().navigate(
                R.id.action_registration_to_processing,
                bundleOf("patientId" to "mock-patient-id")
            )
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentPatientRegistrationBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding.toolbar.consumeStatusBarTopInset()

        binding.toolbar.setNavigationOnClickListener { findNavController().navigateUp() }

        val sexOptions = listOf(
            getString(R.string.sex_male), getString(R.string.sex_female), getString(R.string.sex_other)
        )
        binding.sexDropdown.setAdapter(
            ArrayAdapter(requireContext(), android.R.layout.simple_list_item_1, sexOptions)
        )

        val languageNames = SUPPORTED_LANGUAGES.map { it.displayName }
        binding.languageDropdown.setAdapter(
            ArrayAdapter(requireContext(), android.R.layout.simple_list_item_1, languageNames)
        )

        binding.skipButton.setOnClickListener {
            // Walk-in: patient_id omitted, /api/screen auto-creates a minimal record
            showImageChooseDialog()

        }

        binding.registerContinueButton.setOnClickListener {
            // TODO: validate + call ViewModel.registerPatient(...), then navigate with
            // the real patient_id returned from POST /api/patients
            val enteredName = binding.nameInput.text?.toString()?.trim()
            val patientName = if (enteredName.isNullOrEmpty()) "New patient" else enteredName
            NotificationHelper.notifyPatientRegistered(requireContext(), patientName)
            showImageChooseDialog()
        }
    }

    private fun showImageChooseDialog(){
        AlertDialog.Builder(requireContext())
            .setTitle("Choose way to pick Image")
            .setItems(
                arrayOf("Fundus Camera", "Local Storage")
            ){
                    _, which->
                when(which){
                    0 -> findNavController().navigate(
                        R.id.action_registration_to_capture,
                        bundleOf("patientId" to "mock-patient-id", "eye" to "OD")
                    )
                    1-> pickImage.launch(
                        PickVisualMediaRequest(
                            ActivityResultContracts.PickVisualMedia.ImageOnly
                        )
                    )
                }
            }
            .show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
