import { UpdateInfo } from '../models/updater.model';
import { ApiService } from './api.service';
import { AxiosResponse } from 'axios';
import { api } from '../boot/axios';

export class updaterService extends ApiService<UpdateInfo> {
  constructor() {
    super('app_version');
  }

  async fetchUpdateInfo(): Promise<AxiosResponse<UpdateInfo[]>> {
    return api.get<UpdateInfo[]>('/app_version/app-version-control');
  }
}

export default new updaterService();
