export class Airport {
  constructor(
    readonly code: string,
    readonly name: string,
    readonly city: string,
    readonly timezone: string = 'America/Bogota'
  ) {}
}

