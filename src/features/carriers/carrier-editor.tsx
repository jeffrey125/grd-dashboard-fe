import { safeError } from '@api/api';
import { useNotifications } from '@components/feedback/notification-provider';
import { useCooldown, useSession } from '@features/auth';
import { LiveUpdatesContext } from '@features/tracking-updates';
import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useBlocker } from '@tanstack/react-router';
import { useContext, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { updateCarrier } from './api';
import {
  type Carrier,
  changedSettings,
  type Settings,
  settingLabels,
  settings,
  settingsFor,
  settingsVersion,
} from './schemas';

export function CarrierEditor({
  carrier,
  blocked,
  onClose,
}: {
  carrier: Carrier;
  blocked: boolean;
  onClose: () => void;
}) {
  const { session } = useSession();
  const queries = useQueryClient();
  const live = useContext(LiveUpdatesContext);
  const { showNotification } = useNotifications();
  const [baseline, setBaseline] = useState(() => settings(carrier));
  const [keptVersion, setKeptVersion] = useState('');
  const [confirmation, setConfirmation] = useState<{ input: Settings; version: string }>();
  const busy = useRef(false);
  const edited = useRef(false);
  const form = useForm<Settings>({
    resolver: zodResolver(settingsFor(carrier.code)),
    defaultValues: baseline,
  });
  const markEdited = () => {
    queueMicrotask(() => {
      edited.current = settingsVersion(form.getValues()) !== settingsVersion(baseline);
    });
  };
  const draft = form.watch();
  const dirty = settingsVersion(draft) !== settingsVersion(baseline);
  const version = settingsVersion(carrier);
  const conflict = version !== settingsVersion(baseline);
  const mutation = useMutation({
    mutationFn: (patch: Partial<Settings>) =>
      updateCarrier(session.client, carrier.externalId, patch),
    retry: false,
  });
  const failure = mutation.error ? safeError(mutation.error) : undefined;
  const remaining = useCooldown(failure?.retryAt ?? 0);
  const pending = mutation.isPending;
  const blocker = useBlocker({
    shouldBlockFn: () => dirty,
    enableBeforeUnload: dirty,
    withResolver: true,
  });
  useEffect(() => {
    const latest = settings(carrier);

    if (settingsVersion(latest) === settingsVersion(baseline)) return;

    const hasCurrentDraft = settingsVersion(form.getValues()) !== settingsVersion(baseline);

    if (!edited.current && !hasCurrentDraft && !pending && !blocked) {
      edited.current = false;
      setBaseline(latest);
      form.reset(latest);
      setKeptVersion('');
    }
  }, [pending, blocked, carrier, form, baseline]);
  // A confirmation applies only to the server values that were actually shown.
  useEffect(() => {
    if (confirmation && confirmation.version !== version) setConfirmation(undefined);
  }, [version, confirmation]);
  async function save(input: Settings) {
    if (busy.current || blocked || remaining || (conflict && keptVersion !== version)) return;
    busy.current = true;
    const generation = session.getSnapshot().generation;
    try {
      await mutation.mutateAsync(changedSettings(baseline, input));
      if (session.getSnapshot().generation !== generation) return;
      live?.refreshCarriers();
      void queries.invalidateQueries({ queryKey: ['carrier-settings'] });
      edited.current = false;
      form.reset(input);
      setBaseline(input);
      showNotification({ message: 'Carrier settings saved.', severity: 'success' });
      onClose();
    } catch {
      // A write can succeed even when its response is lost; always reconcile.
      if (session.getSnapshot().generation === generation) {
        live?.refreshCarriers();
        void queries.invalidateQueries({ queryKey: ['carrier-settings'] });
      }
    } finally {
      busy.current = false;
    }
  }
  const submit = form.handleSubmit(async (input) => {
    if (!Object.keys(changedSettings(baseline, input)).length) {
      onClose();
      return;
    }
    if (conflict || (carrier.isActive && !input.isActive)) setConfirmation({ input, version });
    else await save(input);
  });
  const locked = pending || !!confirmation;
  const cannotSave =
    blocked || pending || remaining > 0 || !dirty || (conflict && keptVersion !== version);
  return (
    <>
      <Stack component="form" aria-label="Edit carrier" noValidate spacing={2} onSubmit={submit}>
        {failure && <Alert severity="error">{failure.message}</Alert>}
        {blocked && (
          <Alert severity="warning">
            Saving is unavailable until the latest carrier settings load successfully. Your draft is
            retained.
          </Alert>
        )}
        {conflict && (
          <Alert severity="warning">
            <Typography>
              Carrier settings changed while you were editing. Your draft has been retained.
            </Typography>
            {Object.entries(changedSettings(baseline, settings(carrier))).map(([key, value]) => (
              <Typography key={key} variant="body2">
                Latest {settingLabels[key as keyof Settings]}:{' '}
                {value === null ? 'Not set' : String(value)}
              </Typography>
            ))}
            <Button
              disabled={pending || blocked}
              onClick={() => {
                const latest = settings(carrier);
                edited.current = false;
                setBaseline(latest);
                form.reset(latest);
                setKeptVersion('');
                setConfirmation(undefined);
                mutation.reset();
              }}
            >
              Use latest settings
            </Button>
            <Button
              disabled={pending || blocked || keptVersion === version}
              onClick={() => setKeptVersion(version)}
            >
              Keep my draft
            </Button>
            <Typography variant="caption">
              Only fields you changed will be saved. Concurrent changes cannot be locked.
            </Typography>
          </Alert>
        )}
        {carrier.code !== 'other' && (
          <TextField
            label="Name"
            {...form.register('name', { onChange: markEdited })}
            disabled={locked}
            error={!!form.formState.errors.name}
            helperText={form.formState.errors.name?.message}
          />
        )}
        <TextField
          label="Active"
          select
          {...form.register('isActive', {
            onChange: markEdited,
            setValueAs: (value) => value === true || value === 'true',
          })}
          disabled={locked}
          slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
        >
          <option value="true">Active</option>
          <option value="false">Disabled</option>
        </TextField>
        {carrier.code !== 'other' && (
          <>
            <Typography component="h3" variant="subtitle1">
              Monitoring safeguards
            </Typography>
            {(
              [
                [
                  'failurePauseEnabled',
                  'failurePauseThreshold',
                  'Pause only the shipment after consecutive lookup failures. Login and session-check failures are counted separately.',
                ],
                [
                  'sessionFailureDisableEnabled',
                  'sessionFailureDisableThreshold',
                  'Disable this carrier after consecutive failed logins or session checks. An admin must re-enable it before monitoring can continue.',
                ],
              ] as const
            ).map(([enabled, threshold, description]) => (
              <Stack key={enabled} spacing={1}>
                <FormControlLabel
                  label={settingLabels[enabled]}
                  control={
                    <Switch
                      checked={draft[enabled]}
                      disabled={locked}
                      onChange={(_event, checked) => {
                        form.setValue(enabled, checked, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                        markEdited();
                      }}
                    />
                  }
                />
                <Typography variant="body2" color="text.secondary">
                  {description}
                </Typography>
                <TextField
                  label={settingLabels[threshold]}
                  type="number"
                  disabled={locked || !draft[enabled]}
                  {...form.register(threshold, { valueAsNumber: true, onChange: markEdited })}
                  error={!!form.formState.errors[threshold]}
                  helperText={
                    form.formState.errors[threshold]?.message ??
                    '1–10 consecutive failures. Default: 2.'
                  }
                  slotProps={{ htmlInput: { min: 1, max: 10, step: 1 } }}
                />
              </Stack>
            ))}
            <Typography variant="caption" color="text.secondary">
              Re-enabling a safeguard resets its counter. Existing pauses and carrier disables
              remain in place.
            </Typography>
            <TextField
              label="Fetch mode"
              select
              {...form.register('fetchMode', { onChange: markEdited })}
              disabled={locked || carrier.code === 'ups'}
              slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
              helperText={
                carrier.code === 'ups'
                  ? 'UPS supports request mode only.'
                  : 'Browser mode requires the operator-configured browser integration.'
              }
            >
              <option value="request">Request</option>
              {['echoship', 'ffe'].includes(carrier.code) && (
                <option value="browser">Browser</option>
              )}
            </TextField>
            {(['notFoundPauseThreshold', 'pollIntervalMinutes', 'rateLimitPerMinute'] as const).map(
              (field) => (
                <TextField
                  key={field}
                  label={settingLabels[field]}
                  type="number"
                  disabled={locked}
                  {...form.register(field, {
                    onChange: markEdited,
                    setValueAs: (value: string | number | null) =>
                      value === '' || value === null
                        ? field === 'rateLimitPerMinute'
                          ? null
                          : Number.NaN
                        : Number(value),
                  })}
                  slotProps={{
                    inputLabel: { shrink: true },
                    htmlInput: {
                      min: field === 'notFoundPauseThreshold' ? 2 : 1,
                      max: 32767,
                      step: 1,
                    },
                  }}
                  error={!!form.formState.errors[field]}
                  helperText={
                    form.formState.errors[field]?.message ??
                    (field === 'rateLimitPerMinute'
                      ? 'Leave blank to clear the configured RPM limit. Provider limits still apply.'
                      : field === 'notFoundPauseThreshold'
                        ? 'Consecutive confirmed not-found results before monitoring pauses. Technical failures do not count.'
                        : 'Approximate interval; carrier minimums and worker timing still apply.')
                  }
                />
              ),
            )}
          </>
        )}
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
          <Button disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={cannotSave}>
            {pending ? 'Saving…' : remaining ? `Try again in ${remaining}s` : 'Save changes'}
          </Button>
        </Stack>
      </Stack>
      <Dialog
        open={!!confirmation}
        onClose={() => {
          if (!pending) setConfirmation(undefined);
        }}
        aria-labelledby="confirm-carrier-title"
      >
        <DialogTitle id="confirm-carrier-title">Confirm carrier changes</DialogTitle>
        <DialogContent>
          {conflict && (
            <Typography>
              Your changed fields will overwrite the latest values for those fields. Other server
              settings will be retained.
            </Typography>
          )}
          {confirmation && carrier.isActive && !confirmation.input.isActive && (
            <Typography>
              Disable {carrier.name}? Existing shipments remain visible. New shipments and new
              tracking refreshes for this carrier will be unavailable. Future scheduled tracking is
              affected; work already in progress may finish. All other changed settings will also be
              saved.
            </Typography>
          )}
          {failure && <Alert severity="error">{failure.message}</Alert>}
          {blocked && (
            <Alert severity="warning">Wait for the latest settings to load before saving.</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button autoFocus disabled={pending} onClick={() => setConfirmation(undefined)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={cannotSave}
            onClick={() => {
              if (confirmation?.version === version) void save(confirmation.input);
            }}
          >
            Confirm save
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={blocker.status === 'blocked'}
        onClose={() => blocker.reset?.()}
        aria-labelledby="discard-carrier-title"
      >
        <DialogTitle id="discard-carrier-title">Discard unsaved carrier changes?</DialogTitle>
        <DialogContent>Your settings have not been saved.</DialogContent>
        <DialogActions>
          <Button autoFocus onClick={() => blocker.reset?.()}>
            Keep editing
          </Button>
          <Button color="error" disabled={pending} onClick={() => blocker.proceed?.()}>
            Discard changes
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
