package com.veyronix.drishti.ui.adapter

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.veyronix.drishti.R
import com.veyronix.drishti.databinding.ItemScreeningHistoryBinding
import com.veyronix.drishti.data.model.ScreeningHistoryItem
import com.veyronix.drishti.data.model.Severity

class ScreeningHistoryAdapter(
    private val onClick: (ScreeningHistoryItem) -> Unit
) : ListAdapter<ScreeningHistoryItem, ScreeningHistoryAdapter.ViewHolder>(DIFF) {

    inner class ViewHolder(val binding: ItemScreeningHistoryBinding) : RecyclerView.ViewHolder(binding.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemScreeningHistoryBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = getItem(position)
        val ctx = holder.itemView.context
        holder.binding.dateText.text = item.dateEyeLabel
        holder.binding.lesionSummaryText.text = item.lesionSummary
        holder.binding.gradeChip.text = item.icdrLabel
        val (bg, fg) = when (item.severity) {
            Severity.NO_DR -> R.drawable.bg_chip_no_dr to R.color.status_no_dr
            Severity.MILD -> R.drawable.bg_chip_mild to R.color.status_mild
            Severity.MODERATE -> R.drawable.bg_chip_moderate to R.color.status_moderate
            Severity.SEVERE -> R.drawable.bg_chip_severe to R.color.status_severe
            Severity.PROLIFERATIVE -> R.drawable.bg_chip_proliferative to R.color.status_proliferative
        }
        holder.binding.gradeChip.setBackgroundResource(bg)
        holder.binding.gradeChip.setTextColor(ctx.getColor(fg))
        holder.binding.root.setOnClickListener { onClick(item) }
    }

    companion object {
        private val DIFF = object : DiffUtil.ItemCallback<ScreeningHistoryItem>() {
            override fun areItemsTheSame(a: ScreeningHistoryItem, b: ScreeningHistoryItem) = a.screeningId == b.screeningId
            override fun areContentsTheSame(a: ScreeningHistoryItem, b: ScreeningHistoryItem) = a == b
        }
    }
}
