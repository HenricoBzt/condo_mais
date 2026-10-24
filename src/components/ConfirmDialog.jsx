import Modal from './Modal'

export default function ConfirmDialog({ open, title = 'Confirmar ação', message, confirmLabel = 'Confirmar', onCancel, onConfirm, destructive = false, busy = false, error = '' }) {
  return <Modal open={open} title={title} onClose={onCancel} onConfirm={onConfirm} confirmLabel={confirmLabel} intent={destructive ? 'danger' : 'primary'} busy={busy}><p className="confirm-message">{message}</p>{error && <p className="modal-error" role="alert">{error}</p>}</Modal>
}
