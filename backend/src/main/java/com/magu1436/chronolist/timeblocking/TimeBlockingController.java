package com.magu1436.chronolist.timeblocking;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

import com.magu1436.chronolist.login.LoginUser;
import com.magu1436.chronolist.scheduler.mapper.SchedulerMapper;
import com.magu1436.chronolist.timeblocking.entity.TemplateBlock;
import com.magu1436.chronolist.timeblocking.entity.TimeBlock;
import com.magu1436.chronolist.timeblocking.entity.TimeBlockTask;
import com.magu1436.chronolist.timeblocking.entity.TimeTable;
import com.magu1436.chronolist.timeblocking.exception.TimeBlockReferenceNotFoundException;
import com.magu1436.chronolist.timeblocking.exception.TimeBlockTaskNotFound;
import com.magu1436.chronolist.timeblocking.exception.TimeTableConflictException;
import com.magu1436.chronolist.timeblocking.exception.TimeTableNotFoundException;
import com.magu1436.chronolist.timeblocking.mapper.TemplateBlockMapper;
import com.magu1436.chronolist.timeblocking.mapper.TimeBlockMapper;
import com.magu1436.chronolist.timeblocking.mapper.TimeBlockTaskMapper;
import com.magu1436.chronolist.timeblocking.service.TemplateBlockService;
import com.magu1436.chronolist.timeblocking.service.TimeBlockService;
import com.magu1436.chronolist.timeblocking.service.TimeBlockTaskService;
import com.magu1436.chronolist.timeblocking.service.TimeTableService;

import lombok.RequiredArgsConstructor;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;


@RequestMapping("api/timeblocking/")
@Controller
@RequiredArgsConstructor
public class TimeBlockingController {

    /**
     * 使うService
     */

    private final TemplateBlockService templateBlockService;
    private final TimeBlockService timeBlockService;
    private final TimeTableService timeTableService;
    private final TimeBlockTaskService timeBlockTaskService;
    

    /**
     * 指定のユーザーIDと日付をもつタイムテーブルを取得して返す.
     * <p>このメソッドは,Json形式のデータを受け取り,そのデータに紐づけられた{@code TimeTable}を返す.</p>
     * <h3>リクエストJsonの形:</h3>
     * <pre> {
     *   date: DateString
     * }</pre>
     * 
     * magu1436
     * @param loginUser ログイン中のユーザー
     * @param  date 参照する日付情報.
     * <ul>
     * <li>{@code date}:yyyy-mm-ddで渡される.
     * </ul>
     * @return 該当の{@code TimeTable}とHTTPStatusを返すレスポンス.
     * 正常終了時は{@code 200 OK}を返す.
     * 指定された日付から取得したタイムテーブルが{@code Null}だったとき.({@code 404 Not Found})
     * @author milk0924
     */
    @GetMapping("timeTable/getByDate/{date}")
    public ResponseEntity<TimeTable> getByDate(@AuthenticationPrincipal LoginUser loginUser, @PathVariable("date") LocalDate date){
        try {
            TimeTable table = timeTableService.getByDate(loginUser.getId(), date);
            return ResponseEntity.ok(table);
        } catch (TimeTableNotFoundException e) {
            System.err.println(e);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }

    /** 
     * 新しいタイムテーブルを作成し,DBに登録した際に割り当てられたIDを返却する.
     * <p>このメソッドは,Json形式のデータを受け取り,そのデータをDBに登録し,登録されたときにそのタイムテーブルに登録されたIDを返却する.</p>
     * <h3>リクエストJsonの形</h3>
     * <pre> {
     *   date: DateString
     * }</pre>
     * @param loginUser ログイン中のユーザー
     * @param timeTable 渡された日付を元に作成されたタイムテーブル
     * <ul>
     * <li> {@code timeTable} DB登録時に渡されたIDと日付をもつ.TimeBlockの情報に関しては無視される.詳細は{@link TimeTable}を参照.
     * </ul>
     * @return 登録の際に渡された{@code ID(int)}とHTTPStatusを返すレスポンス.
     * 正常終了時は{@code 201 Created}を返す. 既に存在する日付の場合は{@code 409 Conflict}を返す.
     * @author milk0924 
     */
    @PostMapping("timeTable/createAt")
    public ResponseEntity<Integer> createAt(@AuthenticationPrincipal LoginUser loginUser, @RequestBody TimeTable timeTable){
        // 受け取ったTimeTableにuserIdを登録
        timeTable.setUserId(loginUser.getId());
        TimeTable registeredTable;
        try {
            registeredTable = timeTableService.createAt(timeTable);
        } catch (TimeTableConflictException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        }
        Integer idFromCreatedTimeTable = registeredTable.getId();
        return ResponseEntity.status(HttpStatus.CREATED).body(idFromCreatedTimeTable);
    }

    /**
     * HOLDブロック取得API
     * <p>このメソッドはログイン中のユーザーがもち,かつHOLD状態の{@code TimeBlock}を全て取得する</p>
     * @param loginUser ログイン中のユーザー
     * @return ログイン中のユーザーがもつHOLD状態の{@code TimeBlock}とHttpStatus
     * 正常終了時は{@code 200 ok}
     */
    @GetMapping("timeBlock/getHoldBlocks")
    public ResponseEntity<List<TimeBlock>> getHoldBlocks(@AuthenticationPrincipal LoginUser loginUser){
        List<TimeBlock> heldBlocks = timeBlockService.getHoldBlocks(loginUser.getId());
        return ResponseEntity.ok(heldBlocks);
    }
    
    /**
     * 新しく{@code TimeBlock}をDBに保存し,保存時に割り当てられたIDを返却する.
     * <p>このメソッドは,Json形式のデータを受け取り,そのデータを{@code TimeTable}に登録する.返却されるIDは登録された{@code TimeTable}とは無関係.</p>
     * <h3>リクエストJsonの形:</h3>
     * <pre> {
     * timeTableId: int,
	 * title: String,
	 * status: TimeBlockStatus,
	 * width: int,
	 * startAt: TimeString,
	 * tasks: List<{@link TimeBlockTask}>,
	 * color: String
     * }</pre>
     * @param loginUser ログイン中のユーザー
     * @param timeBlock Jsonの内容が入れられた{@code TimeBlock}.{@code int id}は登録のときに自動で渡される.詳細は{@link TimeBlock}.
     * <ul>
     * <li> {@code TimeBlock}:{@code TimeTableId}はこのタイムブロックを保存するタイムテーブルのIDが渡される. </li>
     * </ul>
     * @return 登録の際に割り当てられた{@code ID(int id)}とHTTPStatusを返すレスポンス.
     * 正常終了時は{@code 201 Created}を返す.
     * @author milk0924
     */
    @PutMapping("timeBlock/register")
    public ResponseEntity<Integer> register(@AuthenticationPrincipal LoginUser loginUser, @RequestBody TimeBlock timeBlock){
        // 受け取ったTimeBlockにuserIdを登録
        try{
            Integer idFromCreatedTimeBlock = timeBlockService.register(loginUser.getId(), timeBlock);
            return ResponseEntity.status(HttpStatus.CREATED).body(idFromCreatedTimeBlock);

        } catch(TimeBlockReferenceNotFoundException e){
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        
    }

    /**
     * データベースで保存されている{@code TimeBlock}のデータを更新する
     * <p>このメソッドはJsonの内容を受け取り,ブロックに関する全てのデータを受け取り更新する事ができる.</p>
     * <h3>リクエストJsonの形:</h3>
     * <pre> {
     * id: int,
	 * timeTableId: int,
	 * status: TimeBlockStatus,
     * relatedSchedule: Schedule,
	 * width: int,
	 * startAt: TimeString,
	 * tasks: List<{@link TimeBlockTask}>,
	 * color: String
     * }</pre>
     */
    @PutMapping("timeBlock/update")
    public ResponseEntity<Void> update(@AuthenticationPrincipal LoginUser loginUser, @RequestBody TimeBlock timeBlock){
        if(!timeBlockService.update(loginUser.getId(), timeBlock)){
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();

    }
   
    /**
     * ブロックの開始時刻のみを更新してデータベースに反映する.
     * <p>このメソッドはJsonの内容を受け取り,指定するIDの{@code startAt: TimeString}のみを渡されたJsonのデータに更新する.</p>
     * <h3>リクエストJsonの形:</h3>
     * <pre> {
     *   id: int,
	 *   startAt: TimeString
     * }</pre>
     * @param timeBlock Jsonの値が保存されている{@code timeBlock}.
     * <ul>
     * <li> {@code timeBlock}:Jsonで渡される以外の情報は持っていない. 参照:{@link TimeBlock}</li>
     * </ul>
     * @return 対応するHTTPStatusを返す.
     * 正常終了時は{@code 204 NoContent}を返す.指定するIDのデータが見つからないとき({@code 404 Not Found})
     * @author milk0924
     */
    @PutMapping("timeBlock/update/startAt")
    public ResponseEntity<Void> startAtUpdate(@AuthenticationPrincipal LoginUser loginUser, @RequestBody TimeBlock timeBlock){
        if(!timeBlockService.updateStartAt(loginUser.getId(), timeBlock.getId(), timeBlock.getStartAt())){
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }


    /**
     * {@code TimeBlock}をDBから削除する.
     * <p>このメソッドはJsonの内容を受け取り,指定するIDの{@code TimeBlock}を削除する.また,そのブロックに紐づけられたタスクデータ,{@code relatedschedule}がある場合はそれらも削除される.</p>
     * <h3>リクエストJsonの形:</h3>
     * <pre> {
     *   id: int
     * }</pre>
     * @param timeBlock Jsonの値が保存されている{@code timeBlock}.
     * @return 対応するHTTPStatusを返す.
     * 正常終了時は{@code 204 No Content}を返す.指定するIDのデータが見つからないとき({@code 404 Not Found})
     * @author milk0924
     */
    @DeleteMapping("timeBlock/delete")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal LoginUser loginUser,@RequestBody TimeBlock timeBlock){
        if(!timeBlockService.delete(loginUser.getId(), timeBlock.getId())){
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    /**
     * {@code TimeBlockTask}をDBに登録する
     * <p>このメソッドはJsonの内容を受け取り,その内容を保存した新しいブロックタスクをDBに保存する.</p>
     * <h3>リクエストJsonの形:</h3>
     * <pre> {
     * timeBlockId: int,
     * title: String
     * }</pre>
     * @param timeBlockTask Jsonの内容が保存された{@code timeBlockTask}.詳細は{@link TimeBlockTask}.
     * <ul>
     * <li> IDはDBに保存されたときに自動的に割り当てられる.</li>
     * </ul>
     * @return DB登録時に割り当てられたIDとHTTPStatusを返すレスポンス.
     * 正常終了時は{@code 201 Created}を返す.
     * @author konoma1103
     */
    @PutMapping("timeBlockTask/register")
    public ResponseEntity<Integer> registerTimeBlockTask(@AuthenticationPrincipal LoginUser loginUser,@RequestBody TimeBlockTask timeBlockTask){
        try{
            Integer idFromCreatedTimeBlockTask = timeBlockTaskService.registerTimeBlockTask(loginUser.getId(), timeBlockTask);
            return ResponseEntity.status(HttpStatus.CREATED).body(idFromCreatedTimeBlockTask);

        } catch(TimeBlockReferenceNotFoundException e){
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        
    }

    /**
     * DB上の {@code TimeBlockTask}を更新する.
     * 
     * @param timeBlockTask Jsonの値が保存されている{@code timeBlockTask}.
     * @return 対応するHTTPStatusを返す.
     * 正常終了時は{@code 204 No Content}を返す.指定するIDのデータが見つからないとき({@code 404 Not Found})
     * @author magu1436
     */
    @PutMapping("timeBlockTask/update")
    public ResponseEntity<Void> updateTimeBlockTask(@AuthenticationPrincipal LoginUser loginUser,@RequestBody TimeBlockTask timeBlockTask){
        if(!timeBlockTaskService.updateTimeBlockTask(loginUser.getId(), timeBlockTask)){
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }

        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    /**
     * {@code TimeBlockTask}をDBから削除する.
     * <p>このメソッドはJsonの内容を受け取り,指定するIDの{@code TimeBlockTask}を削除する.</p>
     * <h3>リクエストJsonの形:</h3>
     * <pre> {
     * id: int
     * }</pre>
     * @param timeBlockTask Jsonの値が保存されている{@code timeBlockTask}.
     * @return 対応するHTTPStatusを返す.
     * 正常終了時は{@code 204 No Content}を返す.
     * 指定するIDのデータが見つからないときは({@code 404 Not Found})を返す.
     * @author konoma1103
     */
    @DeleteMapping("timeBlockTask/delete")
    public ResponseEntity<Void> deleteTimeBlockTask(@AuthenticationPrincipal LoginUser loginUser, @RequestBody TimeBlockTask timeBlockTask){
        // 指定のIDをもつTimeBlockTaskがDBに存在する場合は削除を実行
        if(!timeBlockTaskService.deleteTimeBlockTask(loginUser.getId(), timeBlockTask.getId())){
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    /**
     * ログイン中のユーザーのユーザーIDをもつテンプレートブロックをすべて返却する
     * <p>このメソッドは,DBに保存されているテンプレートブロックを取得し返却する.テンプレートブロックが存在しない場合でも,空のリストを返却する.</p>
     * 
     * @param loginUser ログイン中のユーザー
     * @return すべてのテンプレートブロックとHTTPStatusを返すレスポンス.
     * 正常終了時は{@code 200 Ok}を返す.
     * @author milk0924
     */
    @GetMapping("templateBlock/getAll")
    public ResponseEntity<List<TemplateBlock>> getAllTemplateBlocks(@AuthenticationPrincipal LoginUser loginUser){
        List<TemplateBlock> allTemplateBlock = templateBlockService.getAllTemplateBlocks(loginUser.getId());
        return ResponseEntity.ok(allTemplateBlock);
    }

    /**
     * 受け取ったデータを持つ新しいテンプレートブロックをDBに保存する.
     * <p>このメソッドはJsonの内容を受け取り,その内容を保存した新しいテンプレートブロックをDBに保存する.</p>
     * <h3>リクエストJsonの形:</h3>
     * <pre> {
     *   title: String,
	 *   width: int,
	 *   color: String
     * }</pre>
     * @param loginUser ログイン中のユーザー
     * @param templateBlock Jsonの内容が保存された{@code templateBlock}.詳細は{@link TemplateBlock}.
     * <ul>
     * <li> {@code TempleBlock}:Jsonに保存されている情報以外は持たない.IDはDBに保存されたときに自動的に割り当てられる.</li>
     * </ul>
     * @return DB登録時に割り当てられたIDとHTTPStatusを返すレスポンス.
     * 正常終了時は{@code 201 Created}を返す.
     * @author milk0924
     */
    @PutMapping("templateBlock/register")
    public ResponseEntity<Integer> registerNewTemplateBlock(@AuthenticationPrincipal LoginUser loginUser, @RequestBody TemplateBlock templateBlock){
        // 受け取ったTemplateBlockにuserIdを登録
        templateBlockService.registerNewTemplateBlock(loginUser.getId(), templateBlock);
        return ResponseEntity.status(HttpStatus.CREATED).body(templateBlock.getId());
    }

    /**
     * テンプレートブロックの情報を更新し,そのデータをDBに反映する.
     * <p>このメソッドはJsonの内容を受け取り,その内容を指定のIDに対応するテンプレートブロックに反映する.</p>
     * <h3>リクエストJsonの形:</h3>
     * <pre> {
     *   id: int,
	 *   title: String,
	 *   width: int,
	 *   color: String
     * }</pre>
     * @param templateBlock Jsonの内容が保存された{@code TemplateBlock}.詳細は{@link TemplateBlock}.
     * @return 対応するHTTPStatusを返すレスポンス.
     * 正常終了時は{@code 204 No Content}を返します.
     * 指定するIDのテンプレートブロックが見つからなかったとき{@code 404 Not Found}
     * @author milk0924
     */
    @PutMapping("templateBlock/update")
    public ResponseEntity<Void> updateTemplateBlock(@AuthenticationPrincipal LoginUser loginUser, @RequestBody TemplateBlock templateBlock){
        if(!templateBlockService.updateTemplateBlock(loginUser.getId(), templateBlock)){
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    /**
     * テンプレートブロックをDBから削除する
     * <h3>リクエストJsonの形:</h3>
     * <pre> {
     *   id: int
     * }</pre>
     * @param templateBlock Jsonの内容が保存された{@code TemplateBlock}.詳細は{@link TemplateBlock}.>
     * @return 対応するHTTPStatusを返すレスポンス.
     * 正常終了時は{@code 204 No Content}を返します.
     * 指定するIDのテンプレートブロックが見つからなかったとき{@code 404 Not Found}
     * @author milk0924
     */
    @DeleteMapping("templateBlock/delete")
    public ResponseEntity<Void> deleteTemplateBlock(@AuthenticationPrincipal LoginUser loginUser, @RequestBody TemplateBlock templateBlock){
        if(!templateBlockService.deleteTemplateBlock(loginUser.getId(), templateBlock.getId())){
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }
}
