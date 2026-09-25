import { ErrorCode, FlightDTO } from "@flight-reservations/shared";
import { SearchFlightsInputPort } from "../inputPorts";
import { SearchFlightsQuery } from "../dtos";
import {
  AirportRepository,
  FlightRepository,
  UnitOfWork,
  Logger,
} from "../../infraestructure/outputPorts";
import { AppError } from "../errorHandler";
import { FlightMapper } from "../mappers";

export class SearchFlightsUseCase implements SearchFlightsInputPort {
  constructor(
    private flightRepository: FlightRepository,
    private airportRepository: AirportRepository,
    private unitOfWork: UnitOfWork,
    private logger: Logger,
  ) {}

  // Shape validation (3 letters, distinct, YYYY-MM-DD) already happened at the HTTP edge
  async execute(query: SearchFlightsQuery): Promise<FlightDTO[]> {
    console.log("query", query);
    const flights = await this.unitOfWork.run(async (tx) => {
      // "Today" is the airport's date according to the database clock
      const today = await this.airportRepository.todayAt(tx, query.origin);
      if (today === null) {
        throw AppError.badRequest(
          ErrorCode.INVALID_REQUEST,
          "Aeropuerto de origen desconocido",
        );
      }
      if (query.date < today) {
        throw AppError.badRequest(
          ErrorCode.INVALID_REQUEST,
          "La fecha no puede ser anterior a hoy",
        );
      }
      const destination = await this.airportRepository.findByCode(
        tx,
        query.destination,
      );
      if (!destination) {
        throw AppError.badRequest(
          ErrorCode.INVALID_REQUEST,
          "Aeropuerto de destino desconocido",
        );
      }

      return this.flightRepository.search(
        tx,
        query.origin,
        query.destination,
        query.date,
      );
    });

    this.logger.debug("Searched flights", { ...query, count: flights.length });
    return flights.map(({ flight, availableSeats, totalSeats }) =>
      FlightMapper.toDTO(flight, availableSeats, totalSeats),
    );
  }
}
