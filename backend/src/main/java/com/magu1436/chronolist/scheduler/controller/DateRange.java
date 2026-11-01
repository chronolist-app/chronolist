package com.magu1436.chronolist.scheduler.controller;

import java.time.LocalDate;

import lombok.Data;

@Data
public class DateRange {
    private LocalDate start_date;
    private LocalDate end_date;
    
}
