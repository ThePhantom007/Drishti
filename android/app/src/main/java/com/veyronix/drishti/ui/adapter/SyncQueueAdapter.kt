package com.veyronix.drishti.ui.adapter

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.veyronix.drishti.R
import com.veyronix.drishti.databinding.ItemSyncQueueBinding
import com.veyronix.drishti.data.model.SyncQueueItem
import com.veyronix.drishti.data.model.SyncState

class SyncQueueAdapter(
    private val onRetry: (SyncQueueItem) -> Unit
) : ListAdapter<SyncQueueItem, SyncQueueAdapter.ViewHolder>(DIFF) {

    inner class ViewHolder(val binding: ItemSyncQueueBinding) : RecyclerView.ViewHolder(binding.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemSyncQueueBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = getItem(position)
        val ctx = holder.itemView.context
        holder.binding.localIdText.text = item.label
        holder.binding.capturedAtText.text = item.capturedAtLabel
        val (label, color) = when (item.state) {
            SyncState.QUEUED -> "Queued" to R.color.sync_queued
            SyncState.UPLOADING -> "Uploading…" to R.color.sync_uploading
            SyncState.UPLOADED -> "Uploaded" to R.color.sync_uploaded
            SyncState.FAILED -> "Failed" to R.color.sync_failed
        }
        holder.binding.syncStatusChip.text = label
        holder.binding.syncStatusChip.setTextColor(ctx.getColor(color))
        holder.binding.retryButton.visibility =
            if (item.state == SyncState.FAILED) android.view.View.VISIBLE else android.view.View.GONE
        holder.binding.retryButton.setOnClickListener { onRetry(item) }
    }

    companion object {
        private val DIFF = object : DiffUtil.ItemCallback<SyncQueueItem>() {
            override fun areItemsTheSame(a: SyncQueueItem, b: SyncQueueItem) = a.localId == b.localId
            override fun areContentsTheSame(a: SyncQueueItem, b: SyncQueueItem) = a == b
        }
    }
}
