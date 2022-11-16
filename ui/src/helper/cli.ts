import { createDockerDesktopClient } from '@docker/extension-api-client';
import { ServiceConfiguration } from '../alfresco/configuration';
// DOCKER DESKTOP Client
const ddClient = createDockerDesktopClient();

// Return Docker available RAM in GB
export const getDockerInfo = async () => {
  try {
    const result = await ddClient.docker.cli.exec('info', [
      '--format',
      '"{{json .}}"',
    ]);
    return result.parseJsonObject();
  } catch (err) {
    console.log('checkRamAvailableError : ', JSON.stringify(err));
    return err;
  }
};

export async function listAllContainers(
  configuration: ServiceConfiguration[],
  network: string = 'alfresco'
): Promise<any[]> {
  const containerList = (await ddClient.docker.listContainers({
    all: true,
    filters: JSON.stringify({
      name: configuration.map((s) => s.service),
      network: [network],
    }),
  })) as any[];
  return containerList;
}

// Create 'alfresco' network if it didn't exist
export const createNetwork = async (name: string) => {
  try {
    await ddClient.docker.cli.exec('network', ['inspect', name]);
  } catch (err) {
    await ddClient.docker.cli.exec('network', ['create', name]);
  }
};

function groupByRunOrder(
  services: ServiceConfiguration[]
): ServiceConfiguration[][] {
  return Object.values(
    services.reduce((acc, s) => {
      (acc[s.run.order] = acc[s.run.order] || []).push(s);
      return acc;
    }, {})
  );
}
export async function runContainers(services: ServiceConfiguration[]) {
  // TODO substitute create network with reduce on network name.
  await createNetwork('alfresco');

  const runGroups = groupByRunOrder(services);
  runGroups.forEach(async (s) => {
    await Promise.all(s.map(deployService));
  });
}

// Stop running containers in 'alfresco' network
export const stopContainers = async (services: ServiceConfiguration[]) => {
  const containers = await listAllContainers(services);
  const containersId = containers.map((c) => c.Id);
  try {
    await ddClient.docker.cli.exec('stop', containersId);
    await ddClient.docker.cli.exec('rm', containersId);
  } catch (e) {
    console.warn(e);
  }
};

// Remove a container if it exists
export const removeContainer = async (containerName: string) => {
  const result = await ddClient.docker.cli.exec('ps', [
    '-q',
    '-a',
    '-f',
    'name=' + containerName,
    '-f',
    'network=alfresco',
  ]);
  if (result.stdout.length > 0) {
    await ddClient.docker.cli.exec('container', ['rm', '-v', containerName]);
  }
};
export async function deployService(config: ServiceConfiguration) {
  const running = await ddClient.docker.cli.exec('ps', [
    '-f',
    'status=running',
    '-f',
    'name=' + config.service,
    '-f',
    'network=' + config.network,
    '-q',
  ]);
  if (running.stdout.length === 0) {
    await removeContainer(config.service);
    await ddClient.docker.cli.exec('run', [
      '-d',
      '--name',
      config.service,
      '--network',
      config.network,
      ...config.run.options,
      config.image,
      config.run.cmd,
    ]);
  }
}

export const readyRepo = async () => {
  try {
    const result = await ddClient.docker.cli.exec('exec', [
      'alfresco',
      'bash -c "curl -s -o /dev/null --max-time 1 -w "%{http_code}" http://localhost:8080/alfresco/s/api/server"',
    ]);
    return result.stdout;
  } catch (err) {
    //console.error(JSON.stringify(err));
    return 'false';
  }
};

export const readySolr = async () => {
  try {
    const result = await ddClient.docker.cli.exec('exec', [
      'solr6',
      'bash -c "curl -s -L -o /dev/null --max-time 1 -w "%{http_code}" --header "X-Alfresco-Search-Secret:secret" http://localhost:8983/solr"',
    ]);
    return result.stdout;
  } catch (err) {
    //console.error(JSON.stringify(err));
    return 'false';
  }
};

export const readyActiveMq = async () => {
  try {
    const result = await ddClient.docker.cli.exec('exec', [
      'activemq',
      'bash -c "curl -u admin:admin -L -s -o /dev/null --max-time 1 -w "%{http_code}" http://localhost:8161"',
    ]);
    return result.stdout;
  } catch (err) {
    //console.error(JSON.stringify(err));
    return 'false';
  }
};

export const readyTransform = async () => {
  try {
    const result = await ddClient.docker.cli.exec('exec', [
      'transform-core-aio',
      'bash -c "curl -s -o /dev/null --max-time 1 -w "%{http_code}" http://localhost:8090"',
    ]);
    return result.stdout;
  } catch (err) {
    //console.error(JSON.stringify(err));
    return 'false';
  }
};

export const readyAca = async () => {
  try {
    const result = await ddClient.docker.cli.exec('exec', [
      'content-app',
      'sh -c "curl -s -o /dev/null --max-time 1 -w "%{http_code}" http://localhost:8080/"',
    ]);
    return result.stdout;
  } catch (err) {
    //console.error(JSON.stringify(err));
    return 'false';
  }
};

export const readyProxy = async () => {
  try {
    const result = await ddClient.docker.cli.exec('exec', [
      'proxy',
      'sh -c "curl -s -o /dev/null --max-time 1 -w "%{http_code}" http://localhost:8080/content-app/"',
    ]);
    return result.stdout;
  } catch (err) {
    //console.error(JSON.stringify(err));
    return 'false';
  }
};

export const readyDb = async () => {
  try {
    const result = await ddClient.docker.cli.exec('exec', [
      'postgres',
      'psql -U alfresco -c "select 1 where false"',
    ]);
    return result.stdout;
  } catch (err) {
    //console.error(JSON.stringify(err));
    return 'false';
  }
};

export const waitTillReadyDb = async () => {
  try {
    await ddClient.docker.cli.exec('exec', [
      'postgres',
      'psql -U alfresco -c "select 1 where false"',
    ]);
    return true;
  } catch (err) {
    waitTillReadyDb();
  }
};

export const viewContainer = async (id: string) => {
  await ddClient.desktopUI.navigate.viewContainer(id);
};

export const openAlfrescoInBrowser = async () => {
  ddClient.host.openExternal('http://localhost:8080/content-app/');
};
