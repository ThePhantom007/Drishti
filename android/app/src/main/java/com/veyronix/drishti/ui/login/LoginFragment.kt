package com.veyronix.drishti.ui.login

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.veyronix.drishti.R
import com.veyronix.drishti.data.SessionManager
import com.veyronix.drishti.databinding.FragmentLoginBinding
import com.veyronix.drishti.util.consumeStatusBarTopInset

/**
 * Demo login gate: any username/password (even blank) is accepted — this is
 * intentionally not real auth. Password is collected for the login "feel" but never
 * validated.
 *
 * TODO: replace [attemptLogin] with a real call once the backend has an auth endpoint;
 * swap [SessionManager] for a persisted (DataStore) session at the same time.
 */
class LoginFragment : Fragment() {

    private var _binding: FragmentLoginBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentLoginBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding.loginContent.consumeStatusBarTopInset()

        binding.loginButton.setOnClickListener { attemptLogin() }

        // "Enter anything and press Enter" — Done on the password field logs in too.
        binding.passwordInput.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_DONE) {
                attemptLogin()
                true
            } else {
                false
            }
        }
    }

    private fun attemptLogin() {
        val username = binding.usernameInput.text?.toString().orEmpty()
        // Password is intentionally not validated — this is a demo login gate, not real auth.
        SessionManager.login(username)

        Toast.makeText(
            requireContext(),
            getString(R.string.login_toast_welcome, SessionManager.workerName),
            Toast.LENGTH_SHORT
        ).show()

        findNavController().navigate(R.id.action_login_to_home)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
