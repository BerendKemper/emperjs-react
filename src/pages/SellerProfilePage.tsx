import { useEffect, useMemo, useState, type FormEvent } from "react";
import { LoginButtons } from "../controls/Auth/LoginButtons";
import { useSession } from "../controls/Auth/useSession";
import {
  createSellerProfileInvite,
  createSellerProfileRequest,
  deleteSellerProfileEmailProvider,
  fetchSellerProfile,
  fetchSellerProfileEmailProvider,
  fetchSellerProfileInvites,
  fetchSellerProfileMembers,
  revokeSellerProfileInvite,
  startSellerProfileOwnershipTransfer,
  updateSellerProfile,
  upsertSellerProfileEmailProvider,
  type EmailProviderConnection,
  type SellerProfile,
  type SellerProfileInvite,
  type SellerProfileMember
} from "../services/sellerProfileApi";
import "./SellerProfilePage.css";

type StatusTone = `idle` | `success` | `error` | `saving`;
type StatusState = { tone: StatusTone; message: string };

export function SellerProfilePage() {
  const { session, isLoading } = useSession();
  const isAuthenticated = Boolean(session?.authenticated);
  const canManageSellerProfile = Boolean(
    session?.roles?.includes(`owner`) ||
    session?.roles?.includes(`admin`) ||
    session?.roles?.includes(`seller`)
  );

  const [selector, setSelector] = useState(``);
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [members, setMembers] = useState<SellerProfileMember[]>([]);
  const [invites, setInvites] = useState<SellerProfileInvite[]>([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profileStatus, setProfileStatus] = useState<StatusState>({ tone: `idle`, message: `` });

  const [requestSlug, setRequestSlug] = useState(``);
  const [requestDisplayName, setRequestDisplayName] = useState(``);
  const [requestNote, setRequestNote] = useState(``);
  const [requestStatus, setRequestStatus] = useState<StatusState>({ tone: `idle`, message: `` });

  const [inviteEmail, setInviteEmail] = useState(``);
  const [inviteRole, setInviteRole] = useState<`admin` | `member`>(`member`);
  const [inviteStatus, setInviteStatus] = useState<StatusState>({ tone: `idle`, message: `` });
  const [isInviteSaving, setIsInviteSaving] = useState(false);

  const [transferTargetUserId, setTransferTargetUserId] = useState(``);
  const [transferStatus, setTransferStatus] = useState<StatusState>({ tone: `idle`, message: `` });
  const [isTransferSaving, setIsTransferSaving] = useState(false);

  const [emailProvider, setEmailProvider] = useState<EmailProviderConnection | null>(null);
  const [mailProvider, setMailProvider] = useState<`google` | `microsoft`>(`microsoft`);
  const [mailAccountEmail, setMailAccountEmail] = useState(``);
  const [mailSenderEmail, setMailSenderEmail] = useState(``);
  const [mailSenderName, setMailSenderName] = useState(``);
  const [mailStatus, setMailStatus] = useState<`active` | `inactive`>(`active`);
  const [mailSettingsStatus, setMailSettingsStatus] = useState<StatusState>({ tone: `idle`, message: `` });
  const [isMailSaving, setIsMailSaving] = useState(false);

  const selectorValue = selector.trim();

  const myMemberRole = useMemo(() => {
    if (!session?.userId) return null;
    return members.find(member => member.userId === session.userId)?.role ?? null;
  }, [members, session?.userId]);

  const canEditIdentity = Boolean(session?.roles?.includes(`owner`) || myMemberRole === `owner`);
  const canManageTeam = Boolean(session?.roles?.includes(`owner`) || myMemberRole === `owner` || myMemberRole === `admin`);
  const canConfigureProfileMail = Boolean(session?.roles?.includes(`owner`) || myMemberRole === `owner`);
  const canTransferOwnership = Boolean(session?.roles?.includes(`owner`) || myMemberRole === `owner`);

  const syncMailForm = (connection: EmailProviderConnection | null) => {
    setEmailProvider(connection);
    setMailProvider(connection?.provider ?? `microsoft`);
    setMailAccountEmail(connection?.account_email ?? ``);
    setMailSenderEmail(connection?.sender_email ?? ``);
    setMailSenderName(connection?.sender_name ?? ``);
    setMailStatus(connection?.status ?? `active`);
  };

  const loadProfileBundle = async (slugOrId: string) => {
    setIsLoadingProfile(true);
    setProfileStatus({ tone: `idle`, message: `` });
    setInviteStatus({ tone: `idle`, message: `` });
    setTransferStatus({ tone: `idle`, message: `` });
    setMailSettingsStatus({ tone: `idle`, message: `` });

    const selectorObj = slugOrId.includes(`-`) && !slugOrId.startsWith(`team-`)
      ? { slug: slugOrId }
      : { slug: slugOrId };

    try {
      const profileData = await fetchSellerProfile(selectorObj);
      let membersData: SellerProfileMember[] = [];
      let invitesData: SellerProfileInvite[] = [];
      let mailData: EmailProviderConnection | null = null;

      try {
        membersData = await fetchSellerProfileMembers(selectorObj);
      } catch {
        membersData = [];
      }
      try {
        invitesData = await fetchSellerProfileInvites(selectorObj);
      } catch {
        invitesData = [];
      }
      try {
        mailData = await fetchSellerProfileEmailProvider(selectorObj);
      } catch {
        mailData = null;
      }

      setProfile(profileData);
      setMembers(membersData);
      setInvites(invitesData);
      syncMailForm(mailData);
      setProfileStatus({ tone: `success`, message: `Seller profile loaded.` });
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : `Failed to load seller profile`;
      setProfile(null);
      setMembers([]);
      setInvites([]);
      syncMailForm(null);
      setProfileStatus({ tone: `error`, message });
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleLoadProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectorValue) return;
    await loadProfileBundle(selectorValue);
  };

  const handleRequestCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRequestStatus({ tone: `saving`, message: `Submitting request...` });
    try {
      const created = await createSellerProfileRequest({
        slug: requestSlug,
        displayName: requestDisplayName,
        requestNote: requestNote || undefined,
      });
      setRequestStatus({ tone: `success`, message: `Request submitted: ${created.id}` });
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : `Failed to submit request`;
      setRequestStatus({ tone: `error`, message });
    }
  };

  const handleProfileUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    setProfileStatus({ tone: `saving`, message: `Saving seller profile...` });
    try {
      const updated = await updateSellerProfile({ id: profile.id }, {
        slug: profile.slug,
        displayName: profile.displayName,
        isMemberListPublic: profile.visibility.isMemberListPublic,
      });
      setProfile(updated);
      setProfileStatus({ tone: `success`, message: `Seller profile updated.` });
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : `Failed to update seller profile`;
      setProfileStatus({ tone: `error`, message });
    }
  };

  const handleInviteCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    setIsInviteSaving(true);
    setInviteStatus({ tone: `saving`, message: `Creating invite...` });
    try {
      const created = await createSellerProfileInvite({ id: profile.id }, {
        email: inviteEmail,
        role: inviteRole,
      });
      setInvites(previous => [created.invite, ...previous]);
      setInviteStatus({
        tone: `success`,
        message: created.acceptedImmediately
          ? `User existed and was added immediately.`
          : `Invite created (${created.delivery}).`,
      });
      setInviteEmail(``);
      setInviteRole(`member`);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : `Failed to create invite`;
      setInviteStatus({ tone: `error`, message });
    } finally {
      setIsInviteSaving(false);
    }
  };

  const handleInviteRevoke = async (inviteId: string) => {
    if (!profile) return;
    setInviteStatus({ tone: `saving`, message: `Revoking invite...` });
    try {
      const revoked = await revokeSellerProfileInvite(inviteId);
      setInvites(previous => previous.map(item => item.id === revoked.id ? revoked : item));
      setInviteStatus({ tone: `success`, message: `Invite revoked.` });
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : `Failed to revoke invite`;
      setInviteStatus({ tone: `error`, message });
    }
  };

  const handleOwnershipTransfer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    setIsTransferSaving(true);
    setTransferStatus({ tone: `saving`, message: `Creating ownership transfer...` });
    try {
      const created = await startSellerProfileOwnershipTransfer({ id: profile.id }, transferTargetUserId);
      setTransferStatus({ tone: `success`, message: `Transfer request created (${created.delivery}).` });
      setTransferTargetUserId(``);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : `Failed to create ownership transfer`;
      setTransferStatus({ tone: `error`, message });
    } finally {
      setIsTransferSaving(false);
    }
  };

  const handleSaveMailSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    setIsMailSaving(true);
    setMailSettingsStatus({ tone: `saving`, message: `Saving email provider settings...` });
    try {
      const updated = await upsertSellerProfileEmailProvider({ id: profile.id }, {
        provider: mailProvider,
        accountEmail: mailAccountEmail || null,
        senderEmail: mailSenderEmail || null,
        senderName: mailSenderName || null,
        status: mailStatus,
      });
      syncMailForm(updated);
      setMailSettingsStatus({ tone: `success`, message: `Email provider settings saved.` });
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : `Failed to save email provider settings`;
      setMailSettingsStatus({ tone: `error`, message });
    } finally {
      setIsMailSaving(false);
    }
  };

  const handleDeleteMailSettings = async () => {
    if (!profile) return;
    setIsMailSaving(true);
    setMailSettingsStatus({ tone: `saving`, message: `Removing email provider settings...` });
    try {
      await deleteSellerProfileEmailProvider({ id: profile.id });
      syncMailForm(null);
      setMailSettingsStatus({ tone: `success`, message: `Email provider settings removed.` });
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : `Failed to remove email provider settings`;
      setMailSettingsStatus({ tone: `error`, message });
    } finally {
      setIsMailSaving(false);
    }
  };

  useEffect(() => {
    if (!profile) return;
    setTransferTargetUserId(``);
  }, [profile?.id]);

  if (isLoading) {
    return <section className="seller-profile-page"><p>Loading session...</p></section>;
  }

  if (!isAuthenticated) {
    return (
      <section className="seller-profile-page">
        <h1>Seller profile</h1>
        <p>Sign in to manage seller profiles and requests.</p>
        <LoginButtons />
      </section>
    );
  }

  if (!canManageSellerProfile) {
    return (
      <section className="seller-profile-page">
        <h1>Seller profile</h1>
        <p>You need a seller/admin/owner role to access this page.</p>
      </section>
    );
  }

  return (
    <section className="seller-profile-page">
      <header>
        <h1>Seller Profile Workspace</h1>
        <p>Request a new seller profile and manage an existing seller profile team.</p>
      </header>

      <div className="seller-profile-page__grid">
        <article className="seller-profile-page__card">
          <h2>Request seller profile</h2>
          <form onSubmit={handleRequestCreate} className="seller-profile-page__form">
            <label>
              <span>Slug</span>
              <input value={requestSlug} onChange={event => setRequestSlug(event.target.value)} required />
            </label>
            <label>
              <span>Display name</span>
              <input value={requestDisplayName} onChange={event => setRequestDisplayName(event.target.value)} required />
            </label>
            <label>
              <span>Request note</span>
              <textarea value={requestNote} onChange={event => setRequestNote(event.target.value)} rows={3} />
            </label>
            <button type="submit" disabled={requestStatus.tone === `saving`}>{requestStatus.tone === `saving` ? `Submitting...` : `Submit request`}</button>
            {requestStatus.message ? <p className={`status status--${requestStatus.tone}`}>{requestStatus.message}</p> : null}
          </form>
        </article>

        <article className="seller-profile-page__card">
          <h2>Load seller profile</h2>
          <form onSubmit={handleLoadProfile} className="seller-profile-page__form">
            <label>
              <span>Seller profile slug</span>
              <input value={selector} onChange={event => setSelector(event.target.value)} placeholder="berend" required />
            </label>
            <button type="submit" disabled={isLoadingProfile}>{isLoadingProfile ? `Loading...` : `Load profile`}</button>
          </form>
          {profileStatus.message ? <p className={`status status--${profileStatus.tone}`}>{profileStatus.message}</p> : null}
        </article>

        {profile ? (
          <>
            <article className="seller-profile-page__card">
              <h2>Profile details</h2>
              <form onSubmit={handleProfileUpdate} className="seller-profile-page__form">
                <label>
                  <span>Slug</span>
                  <input
                    value={profile.slug}
                    onChange={event => setProfile(previous => previous ? { ...previous, slug: event.target.value } : previous)}
                    disabled={!canEditIdentity}
                  />
                </label>
                <label>
                  <span>Display name</span>
                  <input
                    value={profile.displayName}
                    onChange={event => setProfile(previous => previous ? { ...previous, displayName: event.target.value } : previous)}
                    disabled={!canEditIdentity}
                  />
                </label>
                <label className="seller-profile-page__checkbox">
                  <input
                    type="checkbox"
                    checked={profile.visibility.isMemberListPublic}
                    onChange={event => setProfile(previous => previous ? {
                      ...previous,
                      visibility: { ...previous.visibility, isMemberListPublic: event.target.checked },
                    } : previous)}
                    disabled={!canEditIdentity}
                  />
                  <span>Member list visible to non-members</span>
                </label>
                <button type="submit" disabled={!canEditIdentity || profileStatus.tone === `saving`}>
                  {profileStatus.tone === `saving` ? `Saving...` : `Save profile`}
                </button>
              </form>
            </article>

            <article className="seller-profile-page__card">
              <h2>Team members</h2>
              <ul className="seller-profile-page__list">
                {members.map(member => (
                  <li key={member.userId}>
                    <strong>{member.displayName ?? member.email}</strong>
                    <span>{member.email}</span>
                    <span className="role-pill">{member.role}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="seller-profile-page__card">
              <h2>Invite members</h2>
              <form onSubmit={handleInviteCreate} className="seller-profile-page__form">
                <label>
                  <span>Email</span>
                  <input type="email" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} disabled={!canManageTeam} required />
                </label>
                <label>
                  <span>Role</span>
                  <select value={inviteRole} onChange={event => setInviteRole(event.target.value as `admin` | `member`)} disabled={!canManageTeam}>
                    <option value="member">member</option>
                    <option value="admin">admin</option>
                  </select>
                </label>
                <button type="submit" disabled={!canManageTeam || isInviteSaving}>{isInviteSaving ? `Inviting...` : `Create invite`}</button>
                {inviteStatus.message ? <p className={`status status--${inviteStatus.tone}`}>{inviteStatus.message}</p> : null}
              </form>
              <ul className="seller-profile-page__list">
                {invites.map(invite => (
                  <li key={invite.id}>
                    <strong>{invite.invited_email}</strong>
                    <span className="role-pill">{invite.role}</span>
                    <span className="role-pill">{invite.status}</span>
                    {invite.status === `pending` && canManageTeam ? (
                      <button type="button" onClick={() => void handleInviteRevoke(invite.id)}>Revoke</button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </article>

            <article className="seller-profile-page__card">
              <h2>Ownership transfer</h2>
              <form onSubmit={handleOwnershipTransfer} className="seller-profile-page__form">
                <label>
                  <span>Target admin user ID</span>
                  <input
                    value={transferTargetUserId}
                    onChange={event => setTransferTargetUserId(event.target.value)}
                    disabled={!canTransferOwnership}
                    required
                  />
                </label>
                <button type="submit" disabled={!canTransferOwnership || isTransferSaving}>
                  {isTransferSaving ? `Creating transfer...` : `Transfer ownership`}
                </button>
                {transferStatus.message ? <p className={`status status--${transferStatus.tone}`}>{transferStatus.message}</p> : null}
              </form>
            </article>

            <article className="seller-profile-page__card">
              <h2>Seller-profile email provider</h2>
              <form onSubmit={handleSaveMailSettings} className="seller-profile-page__form">
                <label>
                  <span>Provider</span>
                  <select value={mailProvider} onChange={event => setMailProvider(event.target.value as `google` | `microsoft`)} disabled={!canConfigureProfileMail}>
                    <option value="microsoft">microsoft</option>
                    <option value="google">google</option>
                  </select>
                </label>
                <label>
                  <span>Account email</span>
                  <input type="email" value={mailAccountEmail} onChange={event => setMailAccountEmail(event.target.value)} disabled={!canConfigureProfileMail} />
                </label>
                <label>
                  <span>Sender email</span>
                  <input type="email" value={mailSenderEmail} onChange={event => setMailSenderEmail(event.target.value)} disabled={!canConfigureProfileMail} />
                </label>
                <label>
                  <span>Sender name</span>
                  <input value={mailSenderName} onChange={event => setMailSenderName(event.target.value)} disabled={!canConfigureProfileMail} />
                </label>
                <label>
                  <span>Status</span>
                  <select value={mailStatus} onChange={event => setMailStatus(event.target.value as `active` | `inactive`)} disabled={!canConfigureProfileMail}>
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                  </select>
                </label>
                <div className="seller-profile-page__actions">
                  <button type="submit" disabled={!canConfigureProfileMail || isMailSaving}>
                    {isMailSaving ? `Saving...` : `Save email provider`}
                  </button>
                  <button type="button" disabled={!canConfigureProfileMail || !emailProvider || isMailSaving} onClick={() => void handleDeleteMailSettings()}>
                    Remove email provider
                  </button>
                </div>
                {mailSettingsStatus.message ? <p className={`status status--${mailSettingsStatus.tone}`}>{mailSettingsStatus.message}</p> : null}
              </form>
            </article>
          </>
        ) : null}
      </div>
    </section>
  );
}
