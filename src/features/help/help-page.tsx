import { PageHeader } from '@components/layout/page-header';
import { useSession } from '@features/auth';
import { useRuntimeFeatures } from '@features/runtime-features';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { createLink, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import rawCaptures from './captures.json';
import { categories, type Guide, guides } from './content';

const RouterButton = createLink(Button);

const captures: Record<
  string,
  { width: number; height: number; markers: { x: number; y: number }[] }
> = rawCaptures;

function Screenshot({ guide, enlarged = false }: { guide: Guide; enlarged?: boolean }) {
  const capture = captures[guide.screenshot];
  if (!capture) return <Alert severity="info">Screenshot is being updated.</Alert>;
  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        minWidth: enlarged ? 900 : undefined,
        bgcolor: '#f4f7fa',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      <Box
        component="img"
        src={`/help/screenshots/${guide.screenshot}.png`}
        alt={`${guide.title}. Numbered markers correspond to the steps alongside this screenshot.`}
        width={capture.width}
        height={capture.height}
        loading="lazy"
        sx={{ display: 'block', width: '100%', height: 'auto' }}
      />
      {capture.markers.map((marker, index) => (
        <Box
          key={guide.steps[index]?.title ?? index}
          aria-hidden="true"
          sx={{
            position: 'absolute',
            left: `clamp(16px, ${marker.x}%, calc(100% - 16px))`,
            top: `clamp(16px, ${marker.y}%, calc(100% - 16px))`,
            transform: 'translate(-50%, -50%)',
            width: 28,
            height: 28,
            borderRadius: '50%',
            bgcolor: '#0055a5',
            color: '#fff',
            border: '2px solid #fff',
            boxShadow: '0 1px 5px #0008',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 800,
            fontSize: 14,
          }}
        >
          {index + 1}
        </Box>
      ))}
    </Box>
  );
}

function GuideCard({ guide, initialOpen }: { guide: Guide; initialOpen: boolean }) {
  const [zoom, setZoom] = useState(false);
  return (
    <Accordion
      defaultExpanded={initialOpen}
      disableGutters
      variant="outlined"
      sx={{ '&:before': { display: 'none' }, borderRadius: '8px !important', overflow: 'hidden' }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        id={`${guide.id}-heading`}
        aria-controls={`${guide.id}-content`}
      >
        <Typography component="span" variant="h6">
          {guide.title}
        </Typography>
      </AccordionSummary>
      <AccordionDetails id={`${guide.id}-content`}>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {guide.intro}
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              lg: 'minmax(0, 1.3fr) minmax(280px, 1fr)',
            },
            gap: 3,
            alignItems: 'start',
          }}
        >
          <Box component="figure" sx={{ m: 0, minWidth: 0 }}>
            <Screenshot guide={guide} />
            <Stack
              direction="row"
              sx={{
                mt: 1,
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1,
              }}
            >
              <Typography component="figcaption" variant="caption" color="text.secondary">
                Illustration using fictional example data.
              </Typography>
              <Button
                startIcon={<ZoomInIcon />}
                onClick={() => setZoom(true)}
                aria-label={`Enlarge screenshot: ${guide.title}`}
              >
                Enlarge
              </Button>
            </Stack>
          </Box>
          <Box>
            <Stack component="ol" spacing={2.5} sx={{ m: 0, pl: 0, listStyle: 'none' }}>
              {guide.steps.map((step, index) => (
                <Stack
                  component="li"
                  key={step.title}
                  direction="row"
                  spacing={1.5}
                  sx={{ alignItems: 'flex-start' }}
                >
                  <Chip
                    label={index + 1}
                    color="primary"
                    size="small"
                    sx={{ minWidth: 28, mt: 0.25 }}
                  />
                  <Box>
                    <Typography component="h4" sx={{ fontWeight: 700 }}>
                      {step.title}
                    </Typography>
                    <Typography sx={{ mt: 0.5 }}>{step.text}</Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
            <Paper variant="outlined" sx={{ p: 2, mt: 3, bgcolor: 'action.hover' }}>
              <Typography sx={{ fontWeight: 700, mb: 1 }}>Good to know</Typography>
              <Box component="ul" sx={{ m: 0, pl: 2.5, '& li + li': { mt: 1 } }}>
                {guide.tips.map((tip) => (
                  <Typography component="li" variant="body2" key={tip}>
                    {tip}
                  </Typography>
                ))}
              </Box>
            </Paper>
          </Box>
        </Box>
      </AccordionDetails>
      <Dialog
        open={zoom}
        onClose={() => setZoom(false)}
        maxWidth="xl"
        fullWidth
        aria-labelledby={`${guide.id}-zoom-title`}
      >
        <DialogTitle id={`${guide.id}-zoom-title`}>{guide.title}</DialogTitle>
        <DialogContent dividers sx={{ overflow: 'auto' }}>
          <Screenshot guide={guide} enlarged />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setZoom(false)} autoFocus>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Accordion>
  );
}

function HelpContent({ category }: { category: string }) {
  const { account, session, status } = useSession();
  const features = useRuntimeFeatures(session.client, status === 'authenticated');
  const [search, setSearch] = useState('');
  const allowed = categories.filter(
    (item) =>
      (item.id !== 'administration' || account?.role === 'admin') &&
      (item.id !== 'quotes' ||
        (features.isSuccess && !features.isError && features.data.quoteComparisonEnabled)),
  );
  const selected = allowed.find((item) => item.id === category);
  const query = search.trim().toLocaleLowerCase();
  const visible = selected
    ? guides[selected.id].filter((guide) =>
        [
          guide.title,
          guide.intro,
          ...guide.steps.flatMap((step) => [step.title, step.text]),
          ...guide.tips,
        ]
          .join(' ')
          .toLocaleLowerCase()
          .includes(query),
      )
    : [];
  return (
    <Stack spacing={3}>
      <PageHeader title="Help" />
      <Typography color="text.secondary">
        Learn the dashboard one task at a time. Choose a category, then follow the numbered
        screenshot markers.
      </Typography>
      <Box
        component="nav"
        aria-label="Help categories"
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            xl: `repeat(${allowed.length}, minmax(0, 1fr))`,
          },
        }}
      >
        {allowed.map((item) => (
          <RouterButton
            key={item.id}
            to="/help"
            search={{ category: item.id }}
            aria-current={item.id === category ? 'page' : undefined}
            variant={item.id === category ? 'contained' : 'outlined'}
            onClick={() => setSearch('')}
            sx={{ justifyContent: 'flex-start', textAlign: 'left', p: 2, height: '100%' }}
          >
            <Box>
              <Typography component="span" sx={{ display: 'block', fontWeight: 700 }}>
                {item.title}
              </Typography>
              <Typography component="span" variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                {item.description}
              </Typography>
            </Box>
          </RouterButton>
        ))}
      </Box>
      {!selected ? (
        <Alert
          severity="info"
          action={
            <RouterButton to="/help" search={{ category: 'getting-started' }}>
              Start here
            </RouterButton>
          }
        >
          This help category is not available for your account.
        </Alert>
      ) : (
        <Stack key={selected.id} spacing={2}>
          <Typography component="h2" variant="h5">
            {selected.title}
          </Typography>
          <TextField
            label="Search this category"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            size="small"
            fullWidth
          />
          {visible.length === 0 ? (
            <Alert
              severity="info"
              action={<Button onClick={() => setSearch('')}>Clear search</Button>}
            >
              No guides match your search.
            </Alert>
          ) : (
            visible.map((guide, index) => (
              <GuideCard
                key={`${guide.id}:${query ? 'search' : 'browse'}`}
                guide={guide}
                initialOpen={index === 0 || !!query}
              />
            ))
          )}
        </Stack>
      )}
    </Stack>
  );
}

export function HelpPage() {
  const { category } = useSearch({ from: '/help' });
  return <HelpContent key={category} category={category} />;
}
