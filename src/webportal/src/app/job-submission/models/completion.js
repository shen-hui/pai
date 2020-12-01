import { isNil } from 'lodash';

export class Completion {
  constructor(props) {
    const { minFailedInstances, minSucceededInstances } = props;
    this.minFailedInstances = minFailedInstances || 1;
    if (!isNil(minSucceededInstances)) {
      this.minSucceededInstances = minSucceededInstances;
    }
  }

  static fromProtocol(completionProtocol) {
    if (isNil(completionProtocol)) {
      return new Completion({});
    }

    return new Completion(completionProtocol);
  }

  convertToProtocolFormat() {
    return {
      minFailedInstances: this.minFailedInstances,
      minSucceededInstances: this.minSucceededInstances,
    };
  }
}
