import React from 'react';
import { Bell, AlertTriangle, CheckCircle, Clock, X, Eye, Check, CheckCheck } from 'lucide-react';
import { INITIAL_NOTIFICATIONS } from './api';

export default function NotificationDrawer({ 
  isOpen, 
  onClose, 
  onSelectNotificationCase, 
  onMarkAsRead, 
  onMarkAllAsRead, 
  notifications = INITIAL_NOTIFICATIONS 
}) {
  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleCardClick = (notif) => {
    if (!notif.read && onMarkAsRead) {
      onMarkAsRead(notif.id);
    }
  };

  const handleReviewCase = (e, notif) => {
    e.stopPropagation();
    if (!notif.read && onMarkAsRead) {
      onMarkAsRead(notif.id);
    }
    if (onSelectNotificationCase) {
      onSelectNotificationCase(notif.caseId || notif.case_id, notif.id);
    }
    onClose();
  };

  const handleToggleSingleRead = (e, notifId) => {
    e.stopPropagation();
    if (onMarkAsRead) {
      onMarkAsRead(notifId);
    }
  };

  return (
    <div className="notification-drawer-overlay" onClick={onClose}>
      <div className="notification-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="notification-drawer-header">
          <div className="drawer-title-box">
            <Bell size={18} className="text-primary" />
            <h3>Clinical Alerts & Notifications</h3>
            {unreadCount > 0 ? (
              <span className="notif-badge-pill">{unreadCount} New</span>
            ) : (
              <span className="notif-badge-allread">All Read</span>
            )}
          </div>
          <button className="btn-icon-close" onClick={onClose} aria-label="Close notifications">
            <X size={18} />
          </button>
        </div>

        <div className="notification-list">
          {notifications.map((n) => (
            <div 
              key={n.id} 
              className={`notification-card ${n.type} ${n.read ? 'read' : 'unread'}`}
              onClick={() => handleCardClick(n)}
              title={n.read ? 'Read' : 'Click to mark as read'}
            >
              <div className="notification-header">
                <div className="notif-type-tag">
                  {!n.read && <span className="notif-unread-dot" title="Unread alert" />}
                  {n.type === 'urgent' && <AlertTriangle size={14} className="text-danger" />}
                  {n.type === 'warning' && <AlertTriangle size={14} className="text-amber" />}
                  {n.type === 'info' && <CheckCircle size={14} className="text-primary" />}
                  <strong className="notif-title-text">{n.title}</strong>
                </div>
                <div className="notif-meta-actions">
                  <span className="notif-time">{n.time}</span>
                  {!n.read ? (
                    <button 
                      className="btn-mark-single-read" 
                      onClick={(e) => handleToggleSingleRead(e, n.id)}
                      title="Mark as read"
                    >
                      <Check size={12} /> Mark Read
                    </button>
                  ) : (
                    <span className="notif-read-status" title="Already read">
                      <CheckCheck size={13} className="text-emerald" />
                    </span>
                  )}
                </div>
              </div>
              
              <p className="notif-desc">{n.desc}</p>
              
              {(n.caseId || n.case_id) && (
                <div className="notif-action-row">
                  <button 
                    className="btn-notif-action"
                    onClick={(e) => handleReviewCase(e, n)}
                  >
                    <Eye size={13} /> Review Case {n.patientId || n.patient_id}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="notification-drawer-footer">
          <button 
            className="btn-ghost full-width" 
            onClick={onMarkAllAsRead}
            disabled={unreadCount === 0}
          >
            <CheckCheck size={15} /> Mark All as Read ({unreadCount})
          </button>
        </div>
      </div>
    </div>
  );
}
