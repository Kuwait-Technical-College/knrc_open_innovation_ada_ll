#include "main.h"
#include "pros/apix.h"
#include <cmath>
#include <cstdio>
#include <cstring>

// Line protocol over the V5 USB user serial port (/dev/ttyACM1 on the Pi):
//   SPIN -> one revolution of the motor on port 1, replies "OK" when done
//   STOP -> stops the motor, replies "OK"
//   anything else -> "ERR unknown command"

namespace {
constexpr int MOTOR_PORT = 1;
constexpr double SPIN_DEGREES = 360.0;
constexpr int32_t SPIN_VELOCITY_RPM = 100;
constexpr uint32_t MOVE_TIMEOUT_MS = 8000;
constexpr double POSITION_TOLERANCE_DEG = 5.0;

void reply(const char* msg) {
	printf("%s\n", msg);
	fflush(stdout);
}

void spin(pros::Motor& motor) {
	motor.tare_position();
	motor.move_relative(SPIN_DEGREES, SPIN_VELOCITY_RPM);
	const uint32_t start = pros::millis();
	while (pros::millis() - start < MOVE_TIMEOUT_MS) {
		if (std::abs(motor.get_position() - SPIN_DEGREES) < POSITION_TOLERANCE_DEG) {
			reply("OK");
			return;
		}
		pros::delay(10);
	}
	motor.brake();
	reply("ERR motor timeout");
}

void command_task(void*) {
	pros::Motor motor(MOTOR_PORT);
	motor.set_encoder_units(pros::E_MOTOR_ENCODER_DEGREES);
	motor.set_brake_mode(pros::E_MOTOR_BRAKE_HOLD);

	char line[32];
	size_t len = 0;
	for (;;) {
		const int c = getchar();
		if (c == EOF) {
			pros::delay(5);
			continue;
		}
		if (c == '\r') continue;
		if (c != '\n') {
			if (len < sizeof(line) - 1) line[len++] = static_cast<char>(c);
			continue;
		}
		line[len] = '\0';
		len = 0;

		if (strcmp(line, "SPIN") == 0) {
			spin(motor);
		} else if (strcmp(line, "STOP") == 0) {
			motor.brake();
			reply("OK");
		} else {
			reply("ERR unknown command");
		}
	}
}
}  // namespace

void initialize() {
	pros::c::serctl(SERCTL_DISABLE_COBS, nullptr);
	pros::Task task(command_task, nullptr, "serial-commands");
}

void disabled() {}
void competition_initialize() {}
void autonomous() {}

void opcontrol() {
	while (true) pros::delay(100);
}
