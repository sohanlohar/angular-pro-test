import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnDestroy,
  HostListener,
} from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { SummaryTile } from '@pos/ezisend/dashboard/data-access/models';
import { CommonService } from '@pos/ezisend/shared/data-access/services';
import * as moment from 'moment';
import {
  BehaviorSubject,
  Subject,
  Subscription,
  catchError,
  takeUntil,
  tap,
} from 'rxjs';
import { en } from 'libs/ezisend/assets/en';
import { bm } from 'libs/ezisend/assets/my';
import { TranslationService } from 'libs/ezisend/shared-services/translate.service';
import { SingleDataSet, Label, Color } from 'ng2-charts';
import { ChartOptions, ChartType } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
@Component({
  selector: 'pos-shipment-summary',
  templateUrl: './shipment-summary.component.html',
  styleUrls: ['./shipment-summary.component.scss'],
  changeDetection: ChangeDetectionStrategy.Default,
})
export class ShipmentSummaryComponent implements OnInit, OnDestroy {
  idleDays = 30;
  $total_cod: BehaviorSubject<any> = new BehaviorSubject<any>(null);
  $total_failed: BehaviorSubject<any> = new BehaviorSubject<any>(null);
  $total_pending: BehaviorSubject<any> = new BehaviorSubject<any>(null);
  currentDate = new Date();
  start_date = '';
  end_date = '';
  boxHeight = 'auto';
  isLoading = false;
  protected _onDestroy = new Subject<void>();
  // Date Range
  dateRangePickerForm: FormGroup = this.fb.group({
    start_date: [moment().subtract(1, 'month')],
    end_date: [moment()],
  });
  public doughnutChartLabels: Label[] = ['COD', 'NON COD'];
  public doughnutChartData: SingleDataSet = [];
  public isEmptyDoughnutChart = true;
  public doughnutChartType: ChartType = 'doughnut';
  public doughnutColors: Color[] = [
    {
      backgroundColor: ['#008BD3', '#00AFAF'],
      borderColor: ['#008BD3', '#00AFAF'],
    },
  ];
  public doughnutChartLegend = false;
  public doughnutChartPlugins = [ChartDataLabels];
  /* doughnut chart */
  public doughnutChartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false, // Allow the chart to fill the container
    cutoutPercentage: 40, // Thicker ring (smaller center circle)
    aspectRatio: 1,
    legend: { position: 'left' },
    layout: { padding: 0 }, // Remove padding around the chart
    tooltips: {
      callbacks: {
        label: (tooltipItem: any, data: any) => {
          const dataset = data.datasets[tooltipItem.datasetIndex];
          const total = dataset.data.reduce(
            (sum: any, value: any) => sum + value,
            0
          );
          const currentValue = dataset.data[tooltipItem.index];
          const percentage = isNaN((currentValue / total) * 100)
            ? 0
            : ((currentValue / total) * 100).toFixed(2);

          return `${
            data.labels[tooltipItem.index]
          }: ${currentValue} (${percentage}%)`;
        },
      },
    },
    plugins: {
      datalabels: {
        color: '#fff', // White color for labels
        font: {
          weight: 'bold',
          size: 16,
        },
      },
    },
  };
  displayedColumns2: string[] = ['delivery_type', 'order_count', 'percentage'];
  dataSource2: any = [];
  expandedRowIndex: number | null = null;

  statistics = {
    byShipment: 0,
    byState: 0,
    byProduct: 0,
    byPayment: 0,
  };

  languageData: any =
    localStorage.getItem('language') &&
    localStorage.getItem('language') === 'en'
      ? en.data.dashboard.insights
      : localStorage.getItem('language') &&
        localStorage.getItem('language') === 'my'
      ? bm.data.dashboard.insights
      : en.data.dashboard.insights;

  statusList = [
    'request-pickup',
    'pending-pickup',
    'live',
    'delivered',
    'failed-delivery',
    'returned',
  ];

  isLoadingStatus: { [key: string]: boolean } = {
    'request-pickup': false,
    live: false,
    delivered: false,
    'failed-delivery': false,
    returned: false,
  };

  private subscription: Subscription | undefined;

  data: any =
    localStorage.getItem('language') &&
    localStorage.getItem('language') === 'en'
      ? en.data
      : localStorage.getItem('language') &&
        localStorage.getItem('language') === 'my'
      ? bm.data
      : en.data;

  summaryTiles: SummaryTile[] = [
    {
      image: 'update',
      title: this.data?.dashboard?.pending_pickup,
      count: 0,
      link: 'pending-pickup',
      color: 'purple-theme-color',
    },
    {
      image: 'local_shipping',
      title: this.data?.dashboard?.live_shipments,
      link: 'live-shipment',
      count: 0,
      color: 'yellow-theme-color',
    },
    {
      image: 'how_to_reg',
      title: this.data?.dashboard?.delivered,
      link: 'delivered',
      count: 0,
      color: 'green-theme-color',
    },
    {
      image: 'close',
      title: this.data?.dashboard?.failed_deliveries,
      link: 'fail-delivered',
      count: 0,
      color: 'red-theme-color',
    },
    {
      image: 'front_hand',
      title: this.data?.dashboard?.returns,
      link: 'return',
      count: 0,
      color: 'gray-theme-color',
    },
  ];

  @HostListener('window:resize', []) updateMode() {
    this.boxHeight = window.innerWidth <= 1084 ? '130px' : 'auto';
  }

  constructor(
    public commonService: CommonService,
    private cdr: ChangeDetectorRef,
    private fb: FormBuilder,
    private translate: TranslationService
  ) {}

  ngOnInit() {
    this.fetchConfig();
    this.translate.buttonClick$.subscribe(() => {
      if (localStorage.getItem('language') == 'en') {
        this.data = en.data;
      } else if (localStorage.getItem('language') == 'my') {
        this.data = bm.data;
      }
    });

    const start_date = moment(this.dateRangePickerForm.value.start_date)
      .startOf('day')
      .format('YYYY-MM-DDTHH:mm:ss[Z]');
    const end_date = moment(this.dateRangePickerForm.value.end_date)
      .startOf('day')
      .format('YYYY-MM-DDTHH:mm:ss[Z]');

    const start_date_2 = moment(this.dateRangePickerForm.value.start_date)
      .startOf('day')
      .format('YYYY-MM-DD');

    const end_date_2 = moment(this.dateRangePickerForm.value.end_date)
      .startOf('day')
      .format('YYYY-MM-DD');

    this.fetchShipmentByPaymentType(start_date_2, end_date_2);
    this.fetchDashboardSummary(start_date, end_date);
  }

  ngOnDestroy(): void {
    this._onDestroy.next();
    this._onDestroy.complete();
  }

  fetchConfig() {
    this.commonService
      .fetchList('user', 'config')
      .pipe(takeUntil(this._onDestroy))
      .subscribe({
        next: (data) => {
          this.commonService.isCOD.next(data.data?.feature_cod);
          this.commonService.isCODUbat.next(data.data?.feature_codubat);
          this.commonService.isMelPlus.next(data.data?.feature_melplus);
          this.commonService.isMPS.next(data.data?.feature_mps);
          const firstNum = data.data.pusher_channels[1].split('-')[2].charAt(0);
          if (firstNum === '8') {
            this.commonService.masterAccount.next(true);
          } else {
            this.commonService.masterAccount.next(false);
          }
        },
        error: () => {
          this.commonService.openErrorDialog();
        },
      });
  }

  onDateRangePickerFormChange(event: any) {
    if (event) {
      this.start_date = moment(event.start_date)
        .startOf('day')
        .format('YYYY-MM-DDTHH:mm:ss[Z]');
      this.end_date = moment(event.end_date)
        .endOf('day')
        .format('YYYY-MM-DDTHH:mm:ss[Z]');
      this.commonService.googleEventPush({
        event: 'filter_section',
        event_category: 'SendParcel Pro - Dashboard',
        event_action: 'Filter Section',
        event_label: this.start_date + ' - ' + this.end_date,
      });
    } else {
      this.start_date = '';
      this.end_date = '';
    }

    const startDatePayment = moment(this.dateRangePickerForm.value.start_date)
      .startOf('day')
      .format('YYYY-MM-DD');

    const endDatePayment = moment(this.dateRangePickerForm.value.end_date)
      .startOf('day')
      .format('YYYY-MM-DD');

    this.fetchDashboardSummary(this.start_date, this.end_date);
    this.fetchShipmentByPaymentType(startDatePayment, endDatePayment);

    this.cdr.detectChanges();
  }

  allStatusLoadingState(): boolean {
    return Object.values(this.isLoadingStatus).every(
      (value) => value === false
    );
  }

  fetchShipmentByPaymentType(startDate: string, endDate: string) {
    this.commonService
      .fetchList(
        'dashboard',
        `payment/method?startDate=${startDate}&endDate=${endDate}`
      )
      .pipe(
        takeUntil(this._onDestroy),
        tap((response: any) => {
          const paymentData = response.data.payment_method_data;
          const codTotal = paymentData.cod || 0;
          const nonCodTotal = paymentData.prepaid || 0;

          this.isEmptyDoughnutChart = codTotal === 0 && nonCodTotal === 0;

          this.dataSource2 = [];

          // Only add to dataSource2 if values are greater than 0
          if (codTotal > 0) {
            this.dataSource2.push({
              name: 'COD',
              color: '#00AFAF',
              value: codTotal,
              percentage:
                codTotal + nonCodTotal !== 0
                  ? ((codTotal * 100) / (codTotal + nonCodTotal)).toFixed(2)
                  : 0,
            });
          }

          if (nonCodTotal > 0) {
            this.dataSource2.push({
              name: 'NON COD',
              color: '#008BD3',
              value: nonCodTotal,
              percentage:
                codTotal + nonCodTotal !== 0
                  ? ((nonCodTotal * 100) / (codTotal + nonCodTotal)).toFixed(2)
                  : 0,
            });
          }

          // Filter out data points with 0 values for the chart
          const filteredData: number[] = [];
          const filteredLabels: string[] = [];

          if (codTotal > 0) {
            filteredData.push(codTotal);
            filteredLabels.push('COD');
          }

          if (nonCodTotal > 0) {
            filteredData.push(nonCodTotal);
            filteredLabels.push('NON COD');
          }

          // Update chart data and labels
          this.doughnutChartData = filteredData;
          this.doughnutChartLabels = filteredLabels;

          // Update isEmptyDoughnutChart based on filtered data
          this.isEmptyDoughnutChart = filteredData.length === 0;

          // Calculate total for statistics
          this.statistics.byPayment = codTotal + nonCodTotal;
        }),
        catchError((err: any) => {
          return err;
        })
      )
      .subscribe(() => {
        this.cdr.detectChanges();
      });
  }

  fetchDashboardSummary(startDate?: string, endDate?: string) {
    this.isLoading = true;
    this.subscription = this.commonService
      .fetchList(
        'dashboard',
        startDate !== ''
          ? `summary?start_date=${startDate}&end_date=${endDate}`
          : 'summary'
      )
      .pipe(takeUntil(this._onDestroy))
      .subscribe({
        next: (data) => {
          this.summaryTiles[0].count = data.data?.pending_pickup_count;
          this.summaryTiles[0].title = this.data.dashboard?.pending_pickup;
          this.summaryTiles[1].count = data.data?.live_shipment_count;
          this.summaryTiles[1].title = this.data.dashboard?.live_shipments;
          this.summaryTiles[2].count = data.data?.delivered_shipment_count;
          this.summaryTiles[2].title = this.data.dashboard?.delivered;
          this.summaryTiles[3].count = data.data?.failed_delivery_count;
          this.summaryTiles[3].title = this.data.dashboard?.failed_deliveries;
          this.summaryTiles[4].count = data.data?.return_cancelled_count;
          this.summaryTiles[4].title = this.data.dashboard?.returns;

          if (this.commonService.isCOD.getValue()) {
            this.commonService.isCOD
              .pipe(takeUntil(this._onDestroy))
              .subscribe(() => {
                this.$total_cod.next(data?.data?.total_cod_collected);
                this.$total_failed.next(data?.data?.total_failed_cod_amount);
                this.$total_pending.next(data?.data?.total_pending_cod_amount);
              });
          }

          this.commonService.$totalRequestPickUp.next(
            data?.data?.request_pickup_count
          );
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.commonService.openErrorDialog();
          this.isLoading = false;
          this.cdr.detectChanges();
        },
      });
  }

  toggleRowExpansion(index: number): void {
    this.expandedRowIndex = this.expandedRowIndex === index ? null : index;
    this.cdr.detectChanges();
  }

  isRowExpanded(index: number): boolean {
    return this.expandedRowIndex === index;
  }
}
