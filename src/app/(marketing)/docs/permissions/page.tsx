import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Team & permissions — OneAce Docs",
  description: "Invite team members and manage role-based permissions in OneAce.",
};

export default function PermissionsPage() {
  return (
    <article className="prose prose-sm max-w-none dark:prose-invert">
      <h1>Team &amp; permissions</h1>
      <p className="lead">
        OneAce uses role-based access control. Each team member has one role that determines what
        they can see and do.
      </p>

      <h2>Roles</h2>
      <table>
        <thead>
          <tr>
            <th>Role</th>
            <th>What they can do</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>OWNER</strong>
            </td>
            <td>Full access. Manage billing, delete org, transfer ownership.</td>
          </tr>
          <tr>
            <td>
              <strong>ADMIN</strong>
            </td>
            <td>
              Full operational access. Manage members, view audit log. Cannot delete org or access
              billing portal.
            </td>
          </tr>
          <tr>
            <td>
              <strong>MANAGER</strong>
            </td>
            <td>Create/edit/delete items, warehouses, movements, POs. Cannot manage members.</td>
          </tr>
          <tr>
            <td>
              <strong>MEMBER</strong>
            </td>
            <td>Create/edit movements and stock counts. Cannot edit items or manage settings.</td>
          </tr>
          <tr>
            <td>
              <strong>VIEWER</strong>
            </td>
            <td>Read-only access to all inventory data.</td>
          </tr>
        </tbody>
      </table>

      <h2>Member limits by plan</h2>
      <ul>
        <li>
          <strong>Free:</strong> up to 3 members
        </li>
        <li>
          <strong>Pro:</strong> up to 10 members
        </li>
        <li>
          <strong>Business:</strong> unlimited members
        </li>
      </ul>
      <p>
        "Members" counts active memberships + pending invitations. If you have 2 active members and
        1 pending invite, that counts as 3.
      </p>

      <h2>Inviting team members</h2>
      <ol>
        <li>
          Go to <strong>Members</strong> in the navigation
        </li>
        <li>
          Click <strong>Invite member</strong>
        </li>
        <li>Enter their email and select a role</li>
        <li>Copy the invite link or send via email (if email is configured)</li>
      </ol>
      <p>Invitations expire after 7 days. You can revoke a pending invitation at any time.</p>

      <h2>Billing access</h2>
      <p>
        Only <strong>OWNER</strong> and <strong>ADMIN</strong> can access{" "}
        <strong>Settings → Billing</strong> and manage subscriptions.
      </p>

      <h2>Audit log access</h2>
      <p>
        The audit log is accessible to <strong>OWNER</strong> and <strong>ADMIN</strong> roles on
        the <strong>Business plan</strong>.
      </p>
    </article>
  );
}
