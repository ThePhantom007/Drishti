package com.veyronix.drishti.util

import android.view.View
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

/**
 * MainActivity calls enableEdgeToEdge(), which lets every screen draw full-bleed behind
 * the status bar (nice for the gradient backgrounds) but means anything pinned to the
 * top of a layout — a Toolbar, a brand mark — renders underneath the status bar / camera
 * cutout on real devices unless it's given matching top padding.
 *
 * Call this on each screen's top-most content view (its Toolbar/AppBarLayout, or the
 * root container on toolbar-less screens) from onViewCreated. It adds the system status
 * bar height as extra top padding — on top of whatever padding the view already has in
 * XML — so the gradient still runs edge-to-edge but the content inside it doesn't.
 */
fun View.consumeStatusBarTopInset() {
    val initialPaddingLeft = paddingLeft
    val initialPaddingTop = paddingTop
    val initialPaddingRight = paddingRight
    val initialPaddingBottom = paddingBottom

    ViewCompat.setOnApplyWindowInsetsListener(this) { view, insets ->
        val statusBarInset = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top
        view.setPadding(
            initialPaddingLeft,
            initialPaddingTop + statusBarInset,
            initialPaddingRight,
            initialPaddingBottom
        )
        insets
    }
    requestApplyInsetsWhenAttached()
}

/** Ensures the inset listener fires even if the view is already attached when this runs. */
private fun View.requestApplyInsetsWhenAttached() {
    if (isAttachedToWindow) {
        ViewCompat.requestApplyInsets(this)
    } else {
        addOnAttachStateChangeListener(object : View.OnAttachStateChangeListener {
            override fun onViewAttachedToWindow(v: View) {
                ViewCompat.requestApplyInsets(v)
            }
            override fun onViewDetachedFromWindow(v: View) = Unit
        })
    }
}
