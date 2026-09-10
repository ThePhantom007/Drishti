classdef ReduceMeanLayer1000 < nnet.layer.Layer & nnet.layer.Formattable
    % A custom layer auto-generated while importing an ONNX network.

    %#ok<*PROPLC>
    %#ok<*NBRAK>
    %#ok<*INUSL>
    %#ok<*VARARG>
    properties (Learnable)
    end

    properties (State)
    end

    properties
        Vars
        NumDims
    end


    methods(Static, Hidden)
        % Specify the path to the class that will be used for codegen
        function name = matlabCodegenRedirect(~)
            name = 'severity_net_epoch_07.coder.ReduceMeanLayer1000';
        end
    end


    methods
        function this = ReduceMeanLayer1000(name)
            this.Name = name;
            this.OutputNames = {'x_blocks_blocks_0__5'};
        end

        function [x_blocks_blocks_0__5] = predict(this, x_blocks_blocks_0_bl)
            if isdlarray(x_blocks_blocks_0_bl)
                x_blocks_blocks_0_bl = stripdims(x_blocks_blocks_0_bl);
            end
            x_blocks_blocks_0_blNumDims = 4;
            x_blocks_blocks_0_bl = severity_net_epoch_07.ops.permuteInputVar(x_blocks_blocks_0_bl, [4 3 1 2], 4);

            [x_blocks_blocks_0__5, x_blocks_blocks_0__5NumDims] = ReduceMeanGraph1000(this, x_blocks_blocks_0_bl, x_blocks_blocks_0_blNumDims, false);
            x_blocks_blocks_0__5 = severity_net_epoch_07.ops.permuteOutputVar(x_blocks_blocks_0__5, [3 4 2 1], 4);

            x_blocks_blocks_0__5 = dlarray(single(x_blocks_blocks_0__5), 'SSCB');
        end

        function [x_blocks_blocks_0__5] = forward(this, x_blocks_blocks_0_bl)
            if isdlarray(x_blocks_blocks_0_bl)
                x_blocks_blocks_0_bl = stripdims(x_blocks_blocks_0_bl);
            end
            x_blocks_blocks_0_blNumDims = 4;
            x_blocks_blocks_0_bl = severity_net_epoch_07.ops.permuteInputVar(x_blocks_blocks_0_bl, [4 3 1 2], 4);

            [x_blocks_blocks_0__5, x_blocks_blocks_0__5NumDims] = ReduceMeanGraph1000(this, x_blocks_blocks_0_bl, x_blocks_blocks_0_blNumDims, true);
            x_blocks_blocks_0__5 = severity_net_epoch_07.ops.permuteOutputVar(x_blocks_blocks_0__5, [3 4 2 1], 4);

            x_blocks_blocks_0__5 = dlarray(single(x_blocks_blocks_0__5), 'SSCB');
        end

        function [x_blocks_blocks_0__5, x_blocks_blocks_0__5NumDims1002] = ReduceMeanGraph1000(this, x_blocks_blocks_0_bl, x_blocks_blocks_0_blNumDims, Training)

            % Execute the operators:
            % ReduceMean:
            dims = severity_net_epoch_07.ops.prepareReduceArgs(this.Vars.ReduceMeanAxes1001, x_blocks_blocks_0_blNumDims);
            xMean = mean(x_blocks_blocks_0_bl, dims);
            x_blocks_blocks_0__5 = xMean;
            x_blocks_blocks_0__5NumDims = x_blocks_blocks_0_blNumDims;

            % Set graph output arguments
            x_blocks_blocks_0__5NumDims1002 = x_blocks_blocks_0__5NumDims;

        end

    end

end