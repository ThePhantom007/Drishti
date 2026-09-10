package com.veyronix.drishti.ui.sync

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.veyronix.drishti.databinding.FragmentSyncQueueBinding
import com.veyronix.drishti.data.model.SyncQueueItem
import com.veyronix.drishti.data.model.SyncState
import com.veyronix.drishti.ui.adapter.SyncQueueAdapter
import com.veyronix.drishti.util.NotificationHelper
import com.veyronix.drishti.util.consumeStatusBarTopInset

/**
 * Always-visible queued-vs-uploaded status, surfaced in detail here. In a poor-
 * connectivity deployment this indicator is one of the most trust-critical UI elements
 * in the app — a worker needs to know their work was actually saved.
 *
 * DEMO STUB: [items] is an in-memory mutable list simulating the offline queue.
 * "Sync Now" flips QUEUED items to UPLOADING then UPLOADED after a short delay; retry
 * does the same for a single FAILED item. Both are fake network calls (Handler delays).
 * TODO: back with a SyncViewModel over your local offline queue (e.g. Room), and wire
 * syncNowButton / per-item retry to a real POST /api/sync call.
 */
class SyncQueueFragment : Fragment() {

    private var _binding: FragmentSyncQueueBinding? = null
    private val binding get() = _binding!!
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var adapter: SyncQueueAdapter

    private val items = mutableListOf(
        SyncQueueItem("local_041", "Ramesh Kumar · local_041", "Captured 9:20 AM", SyncState.UPLOADED),
        SyncQueueItem("local_042", "Walk-in patient · local_042", "Captured 9:42 AM", SyncState.UPLOADED),
        SyncQueueItem("local_043", "Sunita Devi · local_043", "Captured 10:05 AM", SyncState.QUEUED),
        SyncQueueItem("local_044", "Lakshmi Bai · local_044", "Captured 10:15 AM", SyncState.FAILED),
        SyncQueueItem("local_045", "Vijay Singh · local_045", "Captured 11:48 AM", SyncState.QUEUED)
    )

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentSyncQueueBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding.toolbar.consumeStatusBarTopInset()

        binding.toolbar.setNavigationOnClickListener { findNavController().navigateUp() }

        adapter = SyncQueueAdapter { item -> retryItem(item.localId) }
        binding.syncQueueList.layoutManager = LinearLayoutManager(requireContext())
        binding.syncQueueList.adapter = adapter

        refreshUi()

        binding.syncNowButton.setOnClickListener { syncAllQueued() }
    }

    private fun refreshUi() {
        binding.queuedCount.text = items.count { it.state == SyncState.QUEUED }.toString()
        binding.uploadedCount.text = items.count { it.state == SyncState.UPLOADED }.toString()
        binding.failedCount.text = items.count { it.state == SyncState.FAILED }.toString()
        adapter.submitList(items.toList())
    }

    private fun syncAllQueued() {
        val queuedIds = items.filter { it.state == SyncState.QUEUED }.map { it.localId }
        if (queuedIds.isEmpty()) return

        setStates(queuedIds, SyncState.UPLOADING)
        handler.postDelayed({
            if (!isAdded) return@postDelayed
            setStates(queuedIds, SyncState.UPLOADED)
            NotificationHelper.notifySyncComplete(requireContext(), queuedIds.size)
        }, 1400)
    }

    private fun retryItem(localId: String) {
        setStates(listOf(localId), SyncState.UPLOADING)
        handler.postDelayed({
            if (!isAdded) return@postDelayed
            setStates(listOf(localId), SyncState.UPLOADED)
            NotificationHelper.notifySyncComplete(requireContext(), 1)
        }, 1200)
    }

    private fun setStates(localIds: List<String>, state: SyncState) {
        for (id in localIds) {
            val index = items.indexOfFirst { it.localId == id }
            if (index != -1) items[index] = items[index].copy(state = state)
        }
        refreshUi()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        handler.removeCallbacksAndMessages(null)
        _binding = null
    }
}
