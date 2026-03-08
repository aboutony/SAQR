// ============================================
// SAQR — Dispatcher
// Multi-Channel Notification Engine
// Severity-Based Routing + Alert History
// ============================================

const Dispatcher = (() => {
    'use strict';

    // -----------------------------------------------
    // Channel Definitions
    // -----------------------------------------------
    const CHANNELS = {
        TOAST: { key: 'toast', label: 'In-App Toast', icon: '🔔' },
        PUSH: { key: 'push', label: 'Browser Push', icon: '📲' },
        EMAIL: { key: 'email', label: 'SMTP Email', icon: '📧' },
        WEBHOOK: { key: 'webhook', label: 'Webhook (Slack/Teams)', icon: '🔗' },
    };

    // Severity → Channel routing matrix
    const ROUTING = {
        low: ['TOAST'],
        medium: ['TOAST', 'PUSH'],
        high: ['TOAST', 'PUSH', 'EMAIL', 'WEBHOOK'],
        critical: ['TOAST', 'PUSH', 'EMAIL', 'WEBHOOK'],
    };

    // Notification types
    const TYPES = {
        TICKET_CREATED: { label: 'Ticket Created', icon: '🆕', priority: 'info' },
        TICKET_ASSIGNED: { label: 'Assigned to You', icon: '📋', priority: 'info' },
        TICKET_STATE: { label: 'State Change', icon: '🔄', priority: 'info' },
        SLA_WARNING: { label: 'SLA Warning', icon: '⚠️', priority: 'warning' },
        SLA_CRITICAL: { label: 'SLA Critical', icon: '🚨', priority: 'critical' },
        SLA_BREACH: { label: 'SLA Breached', icon: '❌', priority: 'critical' },
        CDC_VERIFIED: { label: 'CDC Verified', icon: '✅', priority: 'success' },
        TICKET_CLOSED: { label: 'Ticket Resolved', icon: '🔒', priority: 'success' },
        SENTINEL_DETECT: { label: 'Sentinel Detection', icon: '🛰️', priority: 'info' },
        REGULATION_UPDATE: { label: 'Regulation Update', icon: '📜', priority: 'warning' },
    };

    // Notification store
    let _notifications = [];
    let _maxHistory = 50;
    let _unreadCount = 0;
    let _listeners = [];
    let _slaCheckInterval = null;

    // -----------------------------------------------
    // Core: Dispatch Notification
    // -----------------------------------------------
    function dispatch(type, payload = {}) {
        const typeDef = TYPES[type] || { label: type, icon: '🔔', priority: 'info' };
        const severity = payload.severity || 'medium';
        const channels = ROUTING[severity] || ROUTING.medium;

        const notification = {
            id: `NTF-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            type,
            typeDef,
            title: payload.title || typeDef.label,
            message: payload.message || '',
            severity,
            channels: channels.map(c => CHANNELS[c]),
            ticketId: payload.ticketId || null,
            authority: payload.authority || null,
            timestamp: new Date().toISOString(),
            read: false,
        };

        _notifications.unshift(notification);
        if (_notifications.length > _maxHistory) {
            _notifications = _notifications.slice(0, _maxHistory);
        }
        _unreadCount++;

        // Route to channels
        channels.forEach(ch => {
            switch (ch) {
                case 'TOAST':
                    _fireToast(notification);
                    break;
                case 'PUSH':
                    _firePush(notification);
                    break;
                case 'EMAIL':
                    _logChannel('EMAIL', notification);
                    break;
                case 'WEBHOOK':
                    _logChannel('WEBHOOK', notification);
                    break;
            }
        });

        _emit('notification', notification);
        _emit('unread:changed', _unreadCount);

        console.log(`[Dispatcher] ${typeDef.icon} ${notification.title} → [${channels.join(', ')}]`);
        return notification;
    }

    // -----------------------------------------------
    // Channel Handlers
    // -----------------------------------------------
    function _fireToast(notification) {
        // Uses the existing SAQR toast system if available
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const priorityColors = {
            info: 'var(--accent-blue)',
            warning: 'var(--accent-amber)',
            critical: 'var(--accent-red)',
            success: 'var(--accent-primary)',
        };
        const color = priorityColors[notification.typeDef.priority] || priorityColors.info;

        const toast = document.createElement('div');
        toast.className = 'disp-toast';
        toast.style.cssText = `border-left: 3px solid ${color}`;
        toast.innerHTML = `
      <div class="disp-toast-header">
        <span class="disp-toast-icon">${notification.typeDef.icon}</span>
        <span class="disp-toast-type">${notification.typeDef.label}</span>
        <span class="disp-toast-time">${_formatTime(notification.timestamp)}</span>
      </div>
      <div class="disp-toast-body">${notification.message}</div>
      ${notification.ticketId ? `<div class="disp-toast-ticket">${notification.ticketId}</div>` : ''}
    `;

        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('disp-toast-visible'));

        setTimeout(() => {
            toast.classList.remove('disp-toast-visible');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    function _firePush(notification) {
        // Browser Notification API (requires permission)
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`SAQR: ${notification.title}`, {
                body: notification.message,
                icon: '/favicon.ico',
                tag: notification.id,
            });
        }
        // Silently skip if not granted — demo mode
    }

    function _logChannel(channel, notification) {
        console.log(`[Dispatcher → ${channel}] ${notification.typeDef.icon} ${notification.title}: ${notification.message}`);
    }

    // -----------------------------------------------
    // WorkflowManager Integration Hooks
    // -----------------------------------------------
    function bindWorkflow(wfm) {
        if (!wfm) return;

        wfm.on('ticket:created', (ticket) => {
            dispatch('TICKET_CREATED', {
                title: 'New Violation Detected',
                message: `${ticket.authority} — ${ticket.title}`,
                severity: ticket.severity,
                ticketId: ticket.id,
                authority: ticket.authority,
            });
        });

        wfm.on('ticket:transitioned', ({ ticket, from, to }) => {
            if (to === 'ASSIGNED') {
                dispatch('TICKET_ASSIGNED', {
                    title: `Assigned: ${ticket.id}`,
                    message: `${ticket.title} → ${ticket.assignee || 'Compliance Officer'}`,
                    severity: ticket.severity,
                    ticketId: ticket.id,
                    authority: ticket.authority,
                });
            } else if (to === 'CLOSED') {
                dispatch('TICKET_CLOSED', {
                    title: `Resolved: ${ticket.id}`,
                    message: `${ticket.title} — remediation complete`,
                    severity: 'low',
                    ticketId: ticket.id,
                    authority: ticket.authority,
                });
            } else {
                dispatch('TICKET_STATE', {
                    title: `${ticket.id}: ${from} → ${to}`,
                    message: ticket.title,
                    severity: ticket.severity === 'critical' ? 'high' : 'medium',
                    ticketId: ticket.id,
                    authority: ticket.authority,
                });
            }
        });

        wfm.on('ticket:cdcVerified', (ticket) => {
            dispatch('CDC_VERIFIED', {
                title: `CDC Verified: ${ticket.id}`,
                message: `${ticket.title} — data matches regulatory constraint`,
                severity: 'medium',
                ticketId: ticket.id,
                authority: ticket.authority,
            });
        });

        // SLA Warning Timer — checks every 10s
        _slaCheckInterval = setInterval(() => {
            const active = wfm.getActiveTickets();
            active.forEach(ticket => {
                if (ticket.state === 'VERIFIED' || ticket.state === 'CLOSED') return;
                const mttr = wfm.getMTTR(ticket);
                if (!mttr) return;

                // SLA Breach
                if (mttr.isOverdue && !ticket._slaBreachNotified) {
                    ticket._slaBreachNotified = true;
                    dispatch('SLA_BREACH', {
                        title: `SLA BREACHED: ${ticket.id}`,
                        message: `${ticket.title} — remediation deadline exceeded`,
                        severity: 'critical',
                        ticketId: ticket.id,
                        authority: ticket.authority,
                    });
                }
                // SLA Critical (< 25% remaining)
                else if (mttr.isCritical && !mttr.isOverdue && !ticket._slaCriticalNotified) {
                    ticket._slaCriticalNotified = true;
                    dispatch('SLA_CRITICAL', {
                        title: `SLA Critical: ${ticket.id}`,
                        message: `${ticket.title} — ${mttr.formatted} remaining`,
                        severity: 'critical',
                        ticketId: ticket.id,
                        authority: ticket.authority,
                    });
                }
                // SLA Warning (> 50% elapsed)
                else if (mttr.percentage > 50 && !mttr.isCritical && !ticket._slaWarningNotified) {
                    ticket._slaWarningNotified = true;
                    dispatch('SLA_WARNING', {
                        title: `SLA Warning: ${ticket.id}`,
                        message: `${ticket.title} — MTTR timer turning amber (${mttr.formatted})`,
                        severity: 'high',
                        ticketId: ticket.id,
                        authority: ticket.authority,
                    });
                }
            });
        }, 10000);

        console.log('[Dispatcher] Bound to WorkflowManager — listening for events');
    }

    // -----------------------------------------------
    // Queries
    // -----------------------------------------------
    function getNotifications() { return [..._notifications]; }
    function getUnreadCount() { return _unreadCount; }

    function markRead(id) {
        const n = _notifications.find(n => n.id === id);
        if (n && !n.read) {
            n.read = true;
            _unreadCount = Math.max(0, _unreadCount - 1);
            _emit('unread:changed', _unreadCount);
        }
    }

    function markAllRead() {
        _notifications.forEach(n => n.read = true);
        _unreadCount = 0;
        _emit('unread:changed', 0);
    }

    // -----------------------------------------------
    // Event System
    // -----------------------------------------------
    function on(event, fn) {
        _listeners.push({ event, fn });
    }

    function _emit(event, data) {
        _listeners.filter(l => l.event === event).forEach(l => l.fn(data));
    }

    // -----------------------------------------------
    // Utilities
    // -----------------------------------------------
    function _formatTime(iso) {
        const d = new Date(iso);
        return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    // -----------------------------------------------
    // Public API
    // -----------------------------------------------
    return {
        dispatch,
        bindWorkflow,
        getNotifications,
        getUnreadCount,
        markRead,
        markAllRead,
        on,
        TYPES,
        CHANNELS,
    };
})();

// Export for module environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Dispatcher;
}
