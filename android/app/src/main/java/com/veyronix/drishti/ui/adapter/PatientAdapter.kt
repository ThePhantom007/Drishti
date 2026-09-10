package com.veyronix.drishti.ui.adapter

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.veyronix.drishti.R
import com.veyronix.drishti.databinding.ItemPatientBinding
import com.veyronix.drishti.data.model.PatientListItem
import com.veyronix.drishti.data.model.ScreeningStatus

/**
 * Binds [PatientListItem]s to the Home screen's "Today's Patients" list.
 * TODO: back this with a ViewModel's LiveData/StateFlow instead of submitList() calls
 * from mock data.
 */
class PatientAdapter(
    private val onClick: (PatientListItem) -> Unit
) : ListAdapter<PatientListItem, PatientAdapter.ViewHolder>(DIFF) {

    inner class ViewHolder(val binding: ItemPatientBinding) : RecyclerView.ViewHolder(binding.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemPatientBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = getItem(position)
        val ctx = holder.itemView.context
        holder.binding.patientName.text = item.name
        holder.binding.patientMeta.text = item.ageSex
        val (label, bg, fg) = when (item.status) {
            ScreeningStatus.PENDING -> Triple(ctx.getString(R.string.status_pending_label), R.drawable.bg_chip_pending, R.color.status_pending)
            ScreeningStatus.GRADED -> Triple(ctx.getString(R.string.status_graded_label), R.drawable.bg_chip_no_dr, R.color.status_no_dr)
            ScreeningStatus.REFERRED -> Triple(ctx.getString(R.string.status_referred_label), R.drawable.bg_chip_severe, R.color.status_severe)
        }
        holder.binding.statusChip.text = label
        holder.binding.statusChip.setBackgroundResource(bg)
        holder.binding.statusChip.setTextColor(ctx.getColor(fg))
        holder.binding.root.setOnClickListener { onClick(item) }
    }

    companion object {
        private val DIFF = object : DiffUtil.ItemCallback<PatientListItem>() {
            override fun areItemsTheSame(a: PatientListItem, b: PatientListItem) = a.patientId == b.patientId
            override fun areContentsTheSame(a: PatientListItem, b: PatientListItem) = a == b
        }
    }
}
