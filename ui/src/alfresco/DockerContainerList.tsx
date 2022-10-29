import {
  Alert,
  AlertTitle,
  Box,
  Button,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import ErrorIcon from '@mui/icons-material/Error';
import React, { useEffect } from 'react';
import { blueGrey } from '@mui/material/colors';
import {
  openAlfrescoInBrowser,
  readyActiveMq,
  readyDb,
  readyRepo,
  readySolr,
  readyTransform,
  viewContainer,
  alfrescoContainers,
} from '../helper/cli';
import { resources } from '../helper/resources';

const startAlfresco = async () => {
  await openAlfrescoInBrowser();
};
export interface ContainerDesc {
  id: string;
  name: string;
  state: string;
  status: string;
  image: string;
  imageName: string;
  version: string;
}

async function getRows() {
  let ready = true;
  let errors = [];
  let rows = [];

  function ifReturn200(restCall) {
    return async () => {
      let status: string = await restCall();
      return status === '200';
    };
  }
  function includeRows(restCall) {
    return async () => {
      let status: string = await restCall();
      return status.includes('rows');
    };
  }
  const readyCheckPolicies = {
    postgres: includeRows(readyDb),
    alfresco: ifReturn200(readyRepo),
    'transform-core-aio': ifReturn200(readyTransform),
    solr6: ifReturn200(readySolr),
    activemq: ifReturn200(readyActiveMq),
  };
  function checkServiceStatus(name) {
    let readyFn = readyCheckPolicies[name];
    if (readyFn) {
      return readyFn() ? 'READY' : 'STARTING';
    }
    return 'UNKNOWN STATUS';
  }

  try {
    const result = await alfrescoContainers();
    for (let i = 0; i < result.length; i++) {
      if (result[i].state === 'exited') {
        errors.push(resources.LIST.ALFRESCO_CONTAINERS_LIST_ERROR);
      } else {
        result[i].state = checkServiceStatus(result[i].name);
      }
      rows.push(result[i]);
    }
  } catch (err) {
    console.log(err);
    // TODO do be managed differently
  }

  return { ready, rows, errors };
}

export const DockerContainerList = () => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [isReady, setIsReady] = React.useState(false);
  const [isError, setIsError] = React.useState('');
  const [rows, setRows] = React.useState([]);

  useEffect(() => {
    let unmounted = false;
    setIsLoading(true);
    const loadContainers = async () => {
      let result = await getRows();
      if (!unmounted) {
        setIsReady(result.ready);
        if (result.errors.length > 0) {
          setIsError(result.errors[0]);
        }
        setRows(result.rows);
        setIsLoading(false);
      }
    };

    loadContainers();
    return () => {
      unmounted = true;
    };
  }, []);

  let statusComponent: {};
  let errorComponent: {};
  if (isError) {
    errorComponent = (
      <Box>
        <Alert severity="error">
          <AlertTitle>ERROR</AlertTitle>
          {isError}
        </Alert>
      </Box>
    );
  } else if (isReady) {
    statusComponent = (
      <React.Fragment>
        <Stack direction="row" spacing={2}>
          <Box>
            <Alert severity="success">
              <AlertTitle>{resources.LIST.ALFRESCO_READY_TITLE}</AlertTitle>
              {resources.LIST.ALFRESCO_READY_MESSAGE}
            </Alert>
          </Box>
          <Button
            variant="contained"
            onClick={() => {
              startAlfresco();
            }}
          >
            {resources.LIST.START}
          </Button>
        </Stack>
      </React.Fragment>
    );
  } else {
    statusComponent = (
      <Box>
        <Alert severity="warning">
          <AlertTitle>{resources.LIST.ALFRESCO_STARTING_TITLE}</AlertTitle>
          {resources.LIST.ALFRESCO_STARTING_MESSAGE}
        </Alert>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box
        sx={{
          marginBottom: '15px',
          textAlign: 'center',
        }}
      >
        <CircularProgress
          size={50}
          sx={{
            color: blueGrey[500],
          }}
        />
      </Box>
    );
  } else if (rows.length === 0) {
    return <React.Fragment></React.Fragment>;
  } else {
    return (
      <React.Fragment>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <b>{resources.LIST.IMAGE}</b>
              </TableCell>
              <TableCell>
                <b>{resources.LIST.VERSION}</b>
              </TableCell>
              <TableCell>
                <b>{resources.LIST.NAME}</b>
              </TableCell>
              <TableCell align="center">
                <b>{resources.LIST.STATUS}</b>
              </TableCell>
              <TableCell align="center">
                <b>{resources.LIST.DETAILS}</b>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.image}
                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  {row.image}
                </TableCell>
                <TableCell>{row.version}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell align="center">{row.state}</TableCell>
                <TableCell align="right">
                  <Button
                    onClick={() => {
                      viewContainer(row.id);
                    }}
                  >
                    {row.state === 'EXITED' && (
                      <ErrorIcon style={{ color: 'red' }} />
                    )}
                    {row.state !== 'EXITED' && <InfoIcon />}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {statusComponent}
        {errorComponent}
      </React.Fragment>
    );
  }
};
