import { SESSION_AREA } from '../features/session/sessionAccess'
import SessionAccessGate from './SessionAccessGate'

export default function AdminSetupAccessGate({ children }) {
  return <SessionAccessGate area={SESSION_AREA.ADMIN_SETUP}>{children}</SessionAccessGate>
}
